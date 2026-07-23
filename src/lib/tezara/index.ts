import type { Logger } from "../logger";
import type { TezaraThesisDetails } from "../types";

const MEILI_URL = "https://meili.tezara.org";
const MEILI_KEY =
  "70e96aa1342ee1ab1ce3d6e2f40e290252ea702f1def87f4071834d034f54831";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the best available abstract from a Meilisearch hit.
 * Prefers original Turkish abstract; falls back to translated.
 */
function extractAbstract(hit: Record<string, unknown>): string {
  let abstract = String(hit.abstract_original ?? "").trim();
  if (!abstract || abstract.length < 10 || /^özet yok\.?$/i.test(abstract)) {
    abstract = String(hit.abstract_translated ?? "").trim();
  }
  return abstract;
}

/** @internal Maps a single Meilisearch hit to a TezaraThesisDetails. */
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
 * Searches Tezara via the Meilisearch JSON API and returns full thesis
 * details (including abstract and YÖK PDF URL) in a single round-trip.
 * No separate fetchThesisDetails call needed.
 *
 * @param query - The search query term.
 * @param logger - Optional Logger instance.
 * @param options - Optional options such as search result limit.
 * @returns A list of thesis details with abstracts.
 */
export async function searchTezara(
  query: string,
  logger?: Logger,
  options?: { limit?: number },
): Promise<TezaraThesisDetails[]> {
  const startTime = performance.now();
  const limit = options?.limit ?? 100;
  const data = await meiliSearch({ q: query, limit }, logger, "search_meili");
  const durationMs = performance.now() - startTime;

  if (!data) return [];

  const hits = data.hits ?? [];
  const results: TezaraThesisDetails[] = [];

  for (const hit of hits) {
    if (!hit.id) continue;
    results.push(mapHitToDetails(hit));
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
