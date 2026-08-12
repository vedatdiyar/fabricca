import type { Logger } from "@/lib/logger";
import type { TezaraThesisDetails } from "@/lib/types";
import {
  DEFAULT_MAX_DELAY,
  HttpError,
  withRetry,
} from "@/lib/api-utils";

const MEILI_URL = process.env.TEZARA_MEILI_URL ?? "";
const MEILI_KEY = process.env.TEZARA_MEILI_KEY ?? "";

/** Maximum number of search attempts for transient Meilisearch failures (429/5xx/network). */
const MEILI_MAX_RETRIES = 3;

/**
 * Parses the `Retry-After` header from a Meilisearch response into milliseconds.
 *
 * @param response - The HTTP response to inspect.
 * @returns The retry delay in milliseconds, or null when absent or unparseable.
 */
function parseRetryAfterHeader(response: Response): number | null {
  const header = response.headers.get("Retry-After");
  if (!header) return null;

  const seconds = parseInt(header, 10);
  if (!isNaN(seconds) && seconds > 0) {
    return seconds * 1000;
  }

  return null;
}

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
 * Executes a request against the Tezara Meilisearch instance with retry on
 * transient failures (429/5xx/network), then either returns the hits or throws.
 *
 * A non-2xx response is thrown as an `HttpError` after retries are exhausted,
 * and network/parse failures are re-thrown — never swallowed — so callers can
 * stop the pipeline and surface the real cause.
 *
 * @param body - Meilisearch search request body.
 * @param logger - Optional logger for observability.
 * @param step - Optional step name for log events.
 * @throws When the request fails after all retry attempts.
 * @returns Matching hits.
 */
async function meiliSearch(
  body: Record<string, unknown>,
  logger?: Logger,
  step?: string,
): Promise<{ hits: Record<string, unknown>[] }> {
  if (!MEILI_URL || !MEILI_KEY) {
    throw new Error(
      "TEZARA_MEILI_URL and TEZARA_MEILI_KEY environment variables are not defined.",
    );
  }

  const startTime = performance.now();
  const timeoutMs = 30_000;

  try {
    return await withRetry(
      async (): Promise<{ hits: Record<string, unknown>[] }> => {
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

          if (!res.ok) {
            const errText = await res.text().catch(() => "");
            throw new HttpError(
              res.status,
              errText,
              parseRetryAfterHeader(res),
            );
          }

          return (await res.json()) as { hits: Record<string, unknown>[] };
        } finally {
          clearTimeout(timeoutId);
        }
      },
      {
        maxRetries: MEILI_MAX_RETRIES,
        baseDelay: 500,
        maxDelay: DEFAULT_MAX_DELAY,
        isRetryable: (error) => {
          if (error instanceof HttpError) {
            return error.status === 429 || error.status >= 500;
          }
          return true;
        },
        getRetryAfter: (error) =>
          error instanceof HttpError ? error.retryAfter : null,
        onRetry: (attempt, delayMs, error) => {
          const status = error instanceof HttpError ? error.status : undefined;
          logger?.info("search_retry", {
            service: "tezara",
            filePath: "src/features/tezara/index.ts",
            step: step ?? "meili_search",
            data: {
              attempt,
              maxRetries: MEILI_MAX_RETRIES,
              delayMs: Math.round(delayMs),
              status,
              errorMessage:
                error instanceof Error ? error.message : String(error),
            },
          });
        },
      },
    );
  } catch (err) {
    const durationMs = performance.now() - startTime;
    logger?.error("search_filtered", {
      service: "tezara",
      filePath: "src/features/tezara/index.ts",
      step: step ?? "meili_search",
      durationMs,
      data: { body },
      error: err,
    });
    throw err;
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

  const hits = data.hits ?? [];
  const results: TezaraThesisDetails[] = [];

  for (const hit of hits) {
    if (!hit.id) continue;
    results.push(mapHitToDetails(hit));
  }

  if (results.length === 0) {
    logger?.info("search_empty", {
      service: "tezara",
      filePath: "src/features/tezara/index.ts",
      step: "search_meili",
      durationMs,
      data: { query },
    });
  }

  return results;
}
