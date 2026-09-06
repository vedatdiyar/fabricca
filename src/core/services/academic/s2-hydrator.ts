import { eq, inArray } from "drizzle-orm";
import { db } from "@/core/db";
import { sources } from "@/core/db/schema";
import { createRateLimiter } from "@/lib/rate-limiter";
import { SEMANTIC_SCHOLAR_LIMITS } from "@/core/config/rate-limits";
import { SEMANTIC_SCHOLAR_GRAPH_BASE_URL } from "@/core/config/endpoints";
import { Logger } from "@/lib/logger";

/**
 * Turnstile queue for Semantic Scholar Graph API identity resolution.
 * Reuses the recommendations 1 req / 1.1s budget to prevent 429 responses.
 */
const s2HydratorQueue = createRateLimiter(SEMANTIC_SCHOLAR_LIMITS);

const PAPER_ID_PATTERN = /^[0-9a-f]{40}$/i;
const OPENALEX_NUMERIC_PATTERN = /W(\d+)\s*$/i;

/**
 * Extracts the numeric OpenAlex work id for MAG lookup.
 *
 * @param openalexId - Raw OpenAlex id or URL.
 * @returns Numeric id string, or null when unparseable.
 */
function extractOpenAlexNumericId(openalexId: string): string | null {
  const match = openalexId.trim().match(OPENALEX_NUMERIC_PATTERN);
  return match?.[1] ? match[1] : null;
}

/**
 * Validates a candidate Semantic Scholar paper id.
 *
 * @param value - Unknown value from the API response.
 * @returns The paper id when valid, otherwise null.
 */
function toValidPaperId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return PAPER_ID_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null;
}

/**
 * Fetches a paper id from a Semantic Scholar Graph API path.
 *
 * @param path - Graph API path including leading slash and query string.
 * @returns Resolved paper id, or null on miss or failure.
 */
async function fetchGraphPaperId(path: string): Promise<string | null> {
  try {
    const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY?.trim();
    const response = await s2HydratorQueue.exec(async () => {
      const headers: Record<string, string> = {};
      if (apiKey) headers["x-api-key"] = apiKey;
      return fetch(`${SEMANTIC_SCHOLAR_GRAPH_BASE_URL}${path}`, {
        headers,
        signal: AbortSignal.timeout(15000),
      });
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (typeof data !== "object" || data === null) return null;
    return toValidPaperId((data as Record<string, unknown>).paperId);
  } catch {
    return null;
  }
}

/**
 * Resolves a Semantic Scholar paper id through the triple-tier chain (DOI, MAG numeric id, title-author search).
 *
 * @param seed - Seed metadata with doi, openalexId, title, and authors.
 * @returns Resolved paper id, or null when all tiers miss.
 */
async function resolvePaperId(seed: {
  doi: string | null;
  openalexId: string | null;
  title: string;
  authors: string[] | null;
}): Promise<string | null> {
  const doi = seed.doi?.trim();
  if (doi && doi.length > 5) {
    const viaDoi = await fetchGraphPaperId(
      `/paper/DOI:${encodeURIComponent(doi)}?fields=paperId`,
    );
    if (viaDoi) return viaDoi;
  }

  const openalexId = seed.openalexId?.trim();
  if (openalexId) {
    const numericId = extractOpenAlexNumericId(openalexId);
    if (numericId) {
      const viaMag = await fetchGraphPaperId(
        `/paper/MAG:${numericId}?fields=paperId`,
      );
      if (viaMag) return viaMag;
    }
  }

  const title = seed.title.trim();
  const firstAuthor = seed.authors?.[0]?.trim();
  if (title.length >= 5) {
    const query = firstAuthor ? `${title} ${firstAuthor}` : title;
    try {
      const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY?.trim();
      const response = await s2HydratorQueue.exec(async () => {
        const headers: Record<string, string> = {};
        if (apiKey) headers["x-api-key"] = apiKey;
        const url =
          `${SEMANTIC_SCHOLAR_GRAPH_BASE_URL}/paper/search` +
          `?query=${encodeURIComponent(query)}&limit=1&fields=paperId`;
        return fetch(url, {
          headers,
          signal: AbortSignal.timeout(15000),
        });
      });
      if (response.ok) {
        const data: unknown = await response.json();
        if (typeof data === "object" && data !== null) {
          const papers = (data as Record<string, unknown>).data;
          if (Array.isArray(papers) && papers.length > 0) {
            const first = papers[0];
            if (typeof first === "object" && first !== null) {
              return toValidPaperId(
                (first as Record<string, unknown>).paperId,
              );
            }
          }
        }
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Backfills missing Semantic Scholar paper ids for the given sources without blocking the caller.
 *
 * @param sourceIds - Source row ids to hydrate.
 * @returns Resolves when all candidates are processed.
 */
export async function hydrateSemanticScholarIds(
  sourceIds: number[],
): Promise<void> {
  const uniqueIds = [...new Set(sourceIds.filter((id) => id > 0))];
  if (uniqueIds.length === 0) return;

  const log = new Logger("s2-hydrator");
  const startedAt = performance.now();

  try {
    const rows = await db
      .select({
        id: sources.id,
        doi: sources.doi,
        openalexId: sources.openalexId,
        title: sources.title,
        authors: sources.authors,
        semanticScholarId: sources.semanticScholarId,
      })
      .from(sources)
      .where(inArray(sources.id, uniqueIds));

    let hydrated = 0;
    for (const row of rows) {
      if (row.semanticScholarId?.trim()) continue;
      const paperId = await resolvePaperId({
        doi: row.doi,
        openalexId: row.openalexId,
        title: row.title,
        authors: row.authors,
      });
      if (!paperId) continue;
      await db
        .update(sources)
        .set({ semanticScholarId: paperId })
        .where(eq(sources.id, row.id));
      hydrated += 1;
    }

    log.info("s2_hydration_success", {
      service: "literature",
      data: {
        requested: uniqueIds.length,
        hydrated,
        durationMs: Math.round(performance.now() - startedAt),
      },
    });
  } catch (err) {
    log.error("s2_hydration_failed", {
      service: "literature",
      error: err,
    });
  }
}
