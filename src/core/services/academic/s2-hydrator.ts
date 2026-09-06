import { eq, inArray } from "drizzle-orm";
import { db } from "@/core/db";
import { sources } from "@/core/db/schema";
import { createRateLimiter } from "@/lib/rate-limiter";
import {
  SEMANTIC_SCHOLAR_LIMITS,
  OPENALEX_REGULAR_LIMITS,
} from "@/core/config/rate-limits";
import {
  SEMANTIC_SCHOLAR_GRAPH_BASE_URL,
  OPENALEX_BASE_URL,
} from "@/core/config/endpoints";
import { OPENALEX_USER_AGENT } from "@/lib/api-utils";
import { Logger } from "@/lib/logger";
import { extractCleanDoi, extractOpenAlexId } from "@/lib/academic/utils";
import { calculateTitleSimilarity } from "./crossref-enrichment";

/**
 * Turnstile queue for Semantic Scholar Graph API identity resolution.
 * Reuses the recommendations 1 req / 1.1s budget to prevent 429 responses.
 */
const s2HydratorQueue = createRateLimiter(SEMANTIC_SCHOLAR_LIMITS);

/**
 * Queue for OpenAlex regular identity resolution calls (allows up to 100 req/s).
 */
const openAlexHydratorQueue = createRateLimiter(OPENALEX_REGULAR_LIMITS);

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

interface ResolvedOpenAlex {
  openalexId: string | null;
  doi?: string | null;
}

/**
 * Resolves an OpenAlex Work ID using:
 * 1. Direct DOI lookup (/works/https://doi.org/{doi})
 * 2. Title + Author search (/works?filter=title.search:{title},raw_author_name.search:{author})
 * 3. Title-only fallback search (/works?filter=title.search:{title})
 *
 * Validates candidate title similarity (>= 0.70) to prevent false positives.
 *
 * @param seed - Seed metadata with doi, title, and authors.
 * @returns Resolved OpenAlex ID and optional canonical DOI.
 */
async function resolveOpenAlexId(seed: {
  doi: string | null;
  title: string;
  authors: string[] | null;
}): Promise<ResolvedOpenAlex> {
  const apiKey = process.env.OPENALEX_API_KEY?.trim();
  const headers: Record<string, string> = {
    "User-Agent": OPENALEX_USER_AGENT,
  };

  // 1. Direct DOI lookup
  const cleanDoi = extractCleanDoi(seed.doi);
  if (cleanDoi) {
    try {
      const url = new URL(
        `${OPENALEX_BASE_URL}/works/https://doi.org/${encodeURIComponent(cleanDoi)}`,
      );
      url.searchParams.set("select", "id,doi,title");
      if (apiKey) url.searchParams.set("api_key", apiKey);

      const response = await openAlexHydratorQueue.exec(async () =>
        fetch(url.toString(), {
          headers,
          signal: AbortSignal.timeout(10000),
        }),
      );

      if (response.ok) {
        const data = (await response.json()) as { id?: string; doi?: string };
        const id = extractOpenAlexId(data.id);
        if (id) {
          return {
            openalexId: id,
            doi: extractCleanDoi(data.doi) || cleanDoi,
          };
        }
      }
    } catch {
      // Fallback to title search
    }
  }

  // 2. Title + Author search
  const cleanTitle = seed.title.trim();
  if (cleanTitle.length >= 5) {
    const sanitizedTitle = cleanTitle
      .replace(/[,|:]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const firstAuthor = seed.authors?.[0]?.trim();
    let authorLastName = "";
    if (firstAuthor) {
      const nameParts = firstAuthor.split(/\s+/).filter(Boolean);
      const rawLast = nameParts[nameParts.length - 1] || firstAuthor;
      authorLastName = rawLast.replace(/[,|:]/g, " ").trim();
    }

    const filterAttempts: string[] = [];
    if (authorLastName && authorLastName.length >= 2) {
      filterAttempts.push(
        `title.search:${sanitizedTitle},raw_author_name.search:${authorLastName}`,
      );
    }
    filterAttempts.push(`title.search:${sanitizedTitle}`);

    for (const filterQuery of filterAttempts) {
      try {
        const params = new URLSearchParams({
          filter: filterQuery,
          per_page: "3",
          select: "id,title,authorships,doi",
        });
        if (apiKey) params.set("api_key", apiKey);

        const url = `${OPENALEX_BASE_URL}/works?${params.toString().replace(/\+/g, "%20")}`;
        const response = await openAlexHydratorQueue.exec(async () =>
          fetch(url, {
            headers,
            signal: AbortSignal.timeout(10000),
          }),
        );

        if (response.ok) {
          const data = (await response.json()) as {
            results?: Array<{ id?: string; title?: string; doi?: string }>;
          };
          const candidates = data.results ?? [];

          for (const candidate of candidates) {
            if (!candidate.title) continue;
            const similarity = calculateTitleSimilarity(
              cleanTitle,
              candidate.title,
            );
            if (similarity >= 0.70) {
              const id = extractOpenAlexId(candidate.id);
              if (id) {
                return {
                  openalexId: id,
                  doi: extractCleanDoi(candidate.doi) || cleanDoi,
                };
              }
            }
          }
        }
      } catch {
        continue;
      }
    }
  }

  return { openalexId: null };
}

/**
 * Backfills missing Semantic Scholar and OpenAlex identifiers for the given sources without blocking the caller.
 * Runs in background (fire-and-forget) to ensure immediate responsiveness for the user.
 *
 * @param sourceIds - Source row ids to hydrate.
 * @returns Resolves when all candidates are processed.
 */
export async function hydrateSourceAcademicIdentifiers(
  sourceIds: number[],
): Promise<void> {
  const uniqueIds = [...new Set(sourceIds.filter((id) => id > 0))];
  if (uniqueIds.length === 0) return;

  const log = new Logger("academic-hydrator");
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

    let hydratedS2 = 0;
    let hydratedOpenAlex = 0;

    for (const row of rows) {
      let currentDoi = row.doi;
      let currentOpenalexId = row.openalexId;
      let currentS2Id = row.semanticScholarId;

      let needsUpdate = false;
      const updatePayload: {
        openalexId?: string;
        semanticScholarId?: string;
        doi?: string;
        updatedAt?: Date;
      } = {};

      // 1. Resolve OpenAlex ID if missing
      if (!currentOpenalexId?.trim()) {
        const resolvedOpenAlex = await resolveOpenAlexId({
          doi: currentDoi,
          title: row.title,
          authors: row.authors,
        });

        if (resolvedOpenAlex.openalexId) {
          currentOpenalexId = resolvedOpenAlex.openalexId;
          updatePayload.openalexId = currentOpenalexId;
          needsUpdate = true;
          hydratedOpenAlex += 1;
        }

        if (resolvedOpenAlex.doi && !currentDoi?.trim()) {
          currentDoi = resolvedOpenAlex.doi;
          updatePayload.doi = currentDoi;
          needsUpdate = true;
        }
      }

      // 2. Resolve Semantic Scholar ID if missing
      if (!currentS2Id?.trim()) {
        const paperId = await resolvePaperId({
          doi: currentDoi,
          openalexId: currentOpenalexId,
          title: row.title,
          authors: row.authors,
        });

        if (paperId) {
          currentS2Id = paperId;
          updatePayload.semanticScholarId = currentS2Id;
          needsUpdate = true;
          hydratedS2 += 1;
        }
      }

      // 3. Persist back to database
      if (needsUpdate) {
        updatePayload.updatedAt = new Date();
        await db
          .update(sources)
          .set(updatePayload)
          .where(eq(sources.id, row.id));
      }
    }

    log.info("academic_identifiers_hydration_success", {
      service: "literature",
      data: {
        requested: uniqueIds.length,
        hydratedS2,
        hydratedOpenAlex,
        durationMs: Math.round(performance.now() - startedAt),
      },
    });
  } catch (err) {
    log.error("academic_identifiers_hydration_failed", {
      service: "literature",
      error: err,
    });
  }
}

/**
 * Backward-compatible alias for hydrateSourceAcademicIdentifiers.
 */
export const hydrateSemanticScholarIds = hydrateSourceAcademicIdentifiers;
