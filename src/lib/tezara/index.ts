import type { Logger } from "../logger";
import type { TezaraThesisDetails } from "../types";

const MEILI_URL = process.env.TEZARA_MEILI_URL ?? "";
const MEILI_KEY = process.env.TEZARA_MEILI_KEY ?? "";

/** Additional Meilisearch search parameters for precision tuning. */
export interface MeiliSearchParams {
  rankingScoreThreshold?: number;
  filter?: string;
  attributesToSearchOn?: string[];
}

/**
 * Extracts the most reliable abstract text from a raw Meilisearch hit.
 *
 * @param hit - Raw Meilisearch hit record.
 * @returns Abstract string, preferring the original over the translated text.
 */
function extractAbstract(hit: Record<string, unknown>): string {
  let abstract = String(hit.abstract_original ?? "").trim();
  if (!abstract || abstract.length < 10 || /^özet yok\.?$/i.test(abstract)) {
    abstract = String(hit.abstract_translated ?? "").trim();
  }
  return abstract;
}

/**
 * Maps a raw Meilisearch hit to thesis details.
 *
 * @param hit - Raw Meilisearch hit record.
 * @returns Thesis details.
 */
function mapHitToDetails(hit: Record<string, unknown>): TezaraThesisDetails {
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
    abstract: extractAbstract(hit),
    yokPdfUrl: hit.pdf_url ? String(hit.pdf_url) : undefined,
  };
}

/**
 * Executes a request against the Tezara Meilisearch instance.
 *
 * @param body - Meilisearch search request body.
 * @param logger - Optional logger for observability.
 * @param step - Optional step name for log events.
 * @returns Matching hits, or null on failure.
 */
async function meiliSearch(
  body: Record<string, unknown>,
  logger?: Logger,
  step?: string,
): Promise<{ hits: Record<string, unknown>[] } | null> {
  if (!MEILI_URL || !MEILI_KEY) {
    throw new Error(
      "TEZARA_MEILI_URL and TEZARA_MEILI_KEY environment variables are not defined.",
    );
  }

  const startTime = performance.now();
  const timeoutMs = 30_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${MEILI_URL}/indexes/theses/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MEILI_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const durationMs = performance.now() - startTime;
      logger?.info("search_filtered", {
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
    clearTimeout(timeoutId);
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

/**
 * Searches Tezara via the Meilisearch JSON API in a single round-trip.
 *
 * @param query - Search query string.
 * @param logger - Optional logger for observability.
 * @param options - Optional search precision settings.
 * @param options.limit - Maximum number of results to return.
 * @param options.rankingScoreThreshold - Minimum ranking score threshold.
 * @param options.filter - Meilisearch filter expression.
 * @param options.attributesToSearchOn - Attributes to restrict the search to.
 * @returns Matching thesis details.
 */
export async function searchTezara(
  query: string,
  logger?: Logger,
  options?: {
    limit?: number;
    rankingScoreThreshold?: number;
    filter?: string;
    attributesToSearchOn?: string[];
  },
): Promise<TezaraThesisDetails[]> {
  const startTime = performance.now();
  const limit = options?.limit ?? 100;
  const body: Record<string, unknown> = { q: query, limit };
  if (options?.rankingScoreThreshold !== undefined) {
    body.rankingScoreThreshold = options.rankingScoreThreshold;
  }
  if (options?.filter !== undefined) {
    body.filter = options.filter;
  }
  if (options?.attributesToSearchOn !== undefined) {
    body.attributesToSearchOn = options.attributesToSearchOn;
  }
  const data = await meiliSearch(body, logger, "search_meili");
  const durationMs = performance.now() - startTime;

  if (!data) return [];

  const hits = data.hits ?? [];
  const results: TezaraThesisDetails[] = [];

  for (const hit of hits) {
    if (!hit.id) continue;
    results.push(mapHitToDetails(hit));
  }

  if (results.length === 0) {
    logger?.info("search_empty", {
      service: "tezara",
      filePath: "src/lib/tezara/index.ts",
      step: "search_meili",
      durationMs,
      data: { query },
    });
  }

  return results;
}
