import type { Logger } from "../logger";
import type { TezaraThesisSummary, TezaraThesisDetails } from "../types";

const MEILI_URL = "https://meili.tezara.org";
const MEILI_KEY =
  "70e96aa1342ee1ab1ce3d6e2f40e290252ea702f1def87f4071834d034f54831";

/**
 * In-memory cache: thesis details are populated during searchTezara so that
 * subsequent fetchThesisDetails calls for the same ID resolve instantly.
 */
const detailsCache = new Map<number, TezaraThesisDetails>();

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/** @internal Maps a single Meilisearch hit to a TezaraThesisSummary. */
function mapHitToSummary(hit: Record<string, unknown>): TezaraThesisSummary {
  const title = hit.title_translated
    ? `${hit.title_original} / ${hit.title_translated}`
    : String(hit.title_original ?? "");

  return {
    id: hit.id as number,
    title,
    author: String(hit.author ?? "N/A"),
    university: String(hit.university ?? "N/A"),
    year: parseInt(String(hit.year ?? "0"), 10) || 0,
    thesisType: String(hit.thesis_type ?? "N/A"),
    department: String(hit.department ?? "N/A"),
    language: hit.language ? String(hit.language) : undefined,
  };
}

/** @internal Extracts the best available abstract from a Meilisearch hit. */
function extractAbstract(hit: Record<string, unknown>): string {
  let abstract = String(hit.abstract_original ?? "").trim();
  if (!abstract || abstract.length < 10 || /^özet yok\.?$/i.test(abstract)) {
    abstract = String(hit.abstract_translated ?? "").trim();
  }
  return abstract;
}

/** @internal Executes a Meilisearch search POST and returns the raw JSON or null. */
async function meiliSearch(
  body: Record<string, unknown>,
  logger?: Logger,
  step?: string,
): Promise<{ hits: Record<string, unknown>[] } | null> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${MEILI_URL}/indexes/theses/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MEILI_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const durationMs = performance.now() - startTime;
      logger?.warn("search_filtered", {
        service: "tezara",
        filePath: "src/lib/tezara/index.ts",
        step: step ?? "meili_search",
        durationMs,
        data: { status: res.status, body },
      });
      return null;
    }

    return (await res.json()) as { hits: Record<string, unknown>[] };
  } catch (err) {
    const durationMs = performance.now() - startTime;
    logger?.error("search_filtered", {
      service: "tezara",
      filePath: "src/lib/tezara/index.ts",
      step: step ?? "meili_search",
      durationMs,
      data: { body },
      error: err,
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Searches Tezara via the Meilisearch JSON API.
 * Automatically pre-caches full thesis details for every hit so that
 * fetchThesisDetails resolves instantly without any extra network calls.
 *
 * @param query - The search query term.
 * @param logger - Optional Logger instance.
 * @param advanced - Retained for API-signature compatibility; has no effect.
 * @returns A list of thesis summaries.
 */
export async function searchTezara(
  query: string,
  logger?: Logger,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _advanced = false,
): Promise<TezaraThesisSummary[]> {
  const startTime = performance.now();
  const data = await meiliSearch({ q: query, limit: 100 }, logger, "search_meili");
  const durationMs = performance.now() - startTime;

  if (!data) return [];

  const hits = data.hits ?? [];
  const results: TezaraThesisSummary[] = [];

  for (const hit of hits) {
    if (!hit.id) continue;

    const summary = mapHitToSummary(hit);
    results.push(summary);

    // Pre-cache full details (abstract + PDF URL) for 0-cost detail fetches
    detailsCache.set(summary.id, {
      ...summary,
      abstract: extractAbstract(hit),
      yokPdfUrl: hit.pdf_url ? String(hit.pdf_url) : undefined,
    });
  }

  if (results.length === 0) {
    logger?.warn("search_empty", {
      service: "tezara",
      filePath: "src/lib/tezara/index.ts",
      step: "search_meili",
      durationMs,
      data: { query },
    });
  }

  return results;
}

/**
 * Pass-through shim retained for API-signature compatibility with callers that
 * paginate. Meilisearch returns up to 100 hits per call so pagination is irrelevant.
 *
 * @param query - The search query term.
 * @param _page - Ignored.
 * @param logger - Optional Logger instance.
 * @param advanced - Ignored.
 * @returns A list of thesis summaries (same as searchTezara).
 */
export async function searchTezaraPage(
  query: string,
  _page: number,
  logger?: Logger,
  advanced = false,
): Promise<TezaraThesisSummary[]> {
  return searchTezara(query, logger, advanced);
}

/**
 * Returns full details for a thesis by ID.
 * Resolves from the in-memory cache if already populated during a prior searchTezara call.
 * Falls back to a targeted Meilisearch query if the entry is not cached.
 *
 * @param summary - The thesis summary object (must contain a valid id).
 * @param logger - Optional Logger instance.
 * @returns The full TezaraThesisDetails, or null on failure.
 */
export async function fetchThesisDetails(
  summary: TezaraThesisSummary,
  logger?: Logger,
): Promise<TezaraThesisDetails | null> {
  if (detailsCache.has(summary.id)) {
    return detailsCache.get(summary.id)!;
  }

  const startTime = performance.now();
  const data = await meiliSearch(
    { q: String(summary.id), limit: 1 },
    logger,
    "fetch_details_fallback",
  );
  const durationMs = performance.now() - startTime;

  if (!data) return null;

  const hit = (data.hits ?? []).find(
    (h: Record<string, unknown>) => h.id === summary.id,
  );

  if (!hit) {
    logger?.warn("search_empty", {
      service: "tezara",
      filePath: "src/lib/tezara/index.ts",
      step: "fetch_details_fallback",
      durationMs,
      data: { thesisId: summary.id, reason: "ID not found in Meilisearch hit" },
    });
    return null;
  }

  const details: TezaraThesisDetails = {
    ...summary,
    abstract: extractAbstract(hit),
    yokPdfUrl: hit.pdf_url ? String(hit.pdf_url) : undefined,
  };

  detailsCache.set(summary.id, details);
  return details;
}


