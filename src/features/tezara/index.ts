import { createClient, type Client } from "@libsql/client/web";
import type { Logger } from "@/lib/logger";
import type { TezaraThesisDetails } from "@/lib/types";
import { DEFAULT_MAX_DELAY, HttpError, withRetry } from "@/lib/api-utils";

const TURSO_URL = process.env.TURSO_DATABASE_URL ?? "";
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN ?? "";
const HF_API_KEY = process.env.HUGGINGFACE_API_KEY ?? "";

const HF_EMBEDDING_ENDPOINT =
  "https://router.huggingface.co/hf-inference/models/intfloat/multilingual-e5-base/pipeline/feature-extraction";

/** Maximum number of retry attempts for transient API/network failures. */
const MAX_RETRIES = 3;

/** Global singleton LibSQL client instance. */
let libsqlClient: Client | null = null;

/**
 * Returns the singleton LibSQL client connected to the Turso thesis database.
 *
 * @throws Error when TURSO_DATABASE_URL or TURSO_AUTH_TOKEN are missing.
 * @returns LibSQL client instance.
 */
function getLibsqlClient(): Client {
  if (libsqlClient) {
    return libsqlClient;
  }

  if (!TURSO_URL || !TURSO_AUTH_TOKEN) {
    throw new Error(
      "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables are not defined.",
    );
  }

  libsqlClient = createClient({
    url: TURSO_URL,
    authToken: TURSO_AUTH_TOKEN,
  });

  return libsqlClient;
}

/**
 * Generates a 768-dimensional embedding vector for a query using
 * `intfloat/multilingual-e5-base` via Hugging Face Serverless Inference API.
 *
 * @param query - Raw query text.
 * @param logger - Optional logger for observability.
 * @returns 768-dimensional dense vector array.
 */
export async function getE5QueryEmbedding(
  query: string,
  logger?: Logger,
): Promise<number[]> {
  if (!HF_API_KEY) {
    throw new Error(
      "HUGGINGFACE_API_KEY environment variable is not defined.",
    );
  }

  const trimmed = query.trim();
  const inputWithPrefix = trimmed.startsWith("query: ")
    ? trimmed
    : `query: ${trimmed}`;

  const startTime = performance.now();

  try {
    const vector = await withRetry(
      async (): Promise<number[]> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20_000);

        try {
          const res = await fetch(HF_EMBEDDING_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${HF_API_KEY}`,
            },
            body: JSON.stringify({ inputs: [inputWithPrefix] }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const errText = await res.text().catch(() => "");
            throw new HttpError(res.status, errText, null);
          }

          const data = (await res.json()) as unknown;

          if (Array.isArray(data) && Array.isArray(data[0])) {
            return data[0] as number[];
          }

          if (Array.isArray(data) && typeof data[0] === "number") {
            return data as number[];
          }

          throw new Error("Unexpected embedding response structure from Hugging Face.");
        } finally {
          clearTimeout(timeoutId);
        }
      },
      {
        maxRetries: MAX_RETRIES,
        baseDelay: 500,
        maxDelay: DEFAULT_MAX_DELAY,
        isRetryable: (error) => {
          if (error instanceof HttpError) {
            return error.status === 429 || error.status >= 500 || error.status === 503;
          }
          return true;
        },
        onRetry: (attempt, delayMs, error) => {
          logger?.info("hf_embedding_retry", {
            service: "tezara",
            filePath: "src/features/tezara/index.ts",
            step: "get_query_embedding",
            data: {
              attempt,
              delayMs: Math.round(delayMs),
              errorMessage:
                error instanceof Error ? error.message : String(error),
            },
          });
        },
      },
    );

    const durationMs = performance.now() - startTime;
    logger?.info("hf_embedding_success", {
      service: "tezara",
      filePath: "src/features/tezara/index.ts",
      step: "get_query_embedding",
      durationMs,
      data: { query: trimmed, dimensions: vector.length },
    });

    return vector;
  } catch (err) {
    const durationMs = performance.now() - startTime;
    logger?.error("hf_embedding_failed", {
      service: "tezara",
      filePath: "src/features/tezara/index.ts",
      step: "get_query_embedding",
      durationMs,
      data: { query: trimmed },
      error: err,
    });
    throw err;
  }
}

/**
 * Extracts the most reliable abstract text from a raw thesis record.
 *
 * @param row - Raw thesis database row.
 * @returns Abstract string, preferring original over translated text.
 */
function extractAbstract(row: Record<string, unknown>): string {
  let abstract = String(row.abstract_original ?? "").trim();
  if (!abstract || abstract.length < 10 || /^özet yok\.?$/i.test(abstract)) {
    abstract = String(row.abstract_translated ?? "").trim();
  }
  return abstract;
}

/**
 * Maps a raw Turso database row to thesis details.
 *
 * @param row - Raw database row from `theses`.
 * @returns Thesis details object.
 */
function mapRowToDetails(row: Record<string, unknown>): TezaraThesisDetails {
  const titleOriginal = String(row.title_original ?? "").trim();
  const titleTranslated = String(row.title_translated ?? "").trim();
  const title =
    titleTranslated && titleTranslated !== titleOriginal
      ? `${titleOriginal} / ${titleTranslated}`
      : titleOriginal;

  return {
    id: Number(row.id),
    title,
    author: String(row.author ?? "N/A"),
    university: String(row.university ?? "N/A"),
    year: parseInt(String(row.year ?? "0"), 10) || 0,
    thesisType: String(row.thesis_type ?? "N/A"),
    department: String(row.department ?? "N/A"),
    language: row.language ? String(row.language) : undefined,
    abstract: extractAbstract(row),
    yokPdfUrl: row.pdf_url ? String(row.pdf_url) : undefined,
  };
}

/** Search options for precision tuning. */
export interface TezaraSearchOptions {
  limit?: number;
  rankingScoreThreshold?: number;
  filter?: string;
  attributesToSearchOn?: string[];
}

/**
 * Extracts clean search keywords from a query string, filtering out stopwords.
 *
 * @param query - Input query text.
 * @returns Array of clean keyword tokens.
 */
function extractSearchTokens(query: string): string[] {
  const stopWords = new Set([
    "ve", "veya", "ile", "için", "bir", "bu", "şu", "o", "da", "de", "ta", "te",
    "the", "and", "or", "of", "in", "on", "at", "for", "with", "a", "an", "to",
    "üzerine", "hakkında", "incelemesi", "analizi", "boyutu", "yaklaşımı", "dönemi"
  ]);

  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !stopWords.has(w))
    .slice(0, 6);
}

/**
 * Fallback keyword search directly querying `theses` table.
 *
 * @param query - Search query string.
 * @param client - LibSQL client instance.
 * @param limit - Maximum rows to return.
 * @returns Matching thesis details.
 */
async function searchThesesByKeywords(
  query: string,
  client: Client,
  limit: number,
): Promise<TezaraThesisDetails[]> {
  const tokens = extractSearchTokens(query);
  if (tokens.length === 0) return [];

  const titleConditions = tokens.map(() => "(title_original LIKE ? OR title_translated LIKE ?)").join(" AND ");
  const abstractConditions = tokens.slice(0, 3).map(() => "(abstract_original LIKE ? OR abstract_translated LIKE ?)").join(" AND ");

  const combinedSql = `
    SELECT id, title_original, title_translated, author, university, institute,
           year, thesis_type, language, department, abstract_original, abstract_translated,
           pdf_url, detail_url, subjects
    FROM theses
    WHERE (${titleConditions}) OR (${abstractConditions})
    ORDER BY year DESC
    LIMIT ?
  `;

  const args: (string | number)[] = [];
  for (const token of tokens) {
    args.push(`%${token}%`, `%${token}%`);
  }
  for (const token of tokens.slice(0, 3)) {
    args.push(`%${token}%`, `%${token}%`);
  }
  args.push(limit);

  const result = await client.execute({ sql: combinedSql, args });
  const results: TezaraThesisDetails[] = [];
  for (const row of result.rows) {
    if (!row.id) continue;
    results.push(mapRowToDetails(row as unknown as Record<string, unknown>));
  }
  return results;
}

/**
 * Searches the thesis database via Turso Vector Index (cosine similarity)
 * using `multilingual-e5-base` 768-dimensional embeddings with seamless keyword fallback.
 *
 * @param query - Search query string.
 * @param logger - Optional logger for observability.
 * @param options - Optional search parameters (limit, etc.).
 * @returns Matching thesis details.
 */
export async function searchTezara(
  query: string,
  logger?: Logger,
  options?: TezaraSearchOptions,
): Promise<TezaraThesisDetails[]> {
  const startTime = performance.now();
  const limit = options?.limit ?? 50;
  const client = getLibsqlClient();

  try {
    const embedding = await getE5QueryEmbedding(query, logger);
    const vectorJson = JSON.stringify(embedding);
    const queryStart = performance.now();

    const sql = `
      SELECT t.id, t.title_original, t.title_translated, t.author, t.university, t.institute,
             t.year, t.thesis_type, t.language, t.department, t.abstract_original, t.abstract_translated,
             t.pdf_url, t.detail_url, t.subjects
      FROM vector_top_k('thesis_vectors_idx', vector16(?), ?) AS top
      JOIN theses t ON t.id = top.id
    `;

    const result = await client.execute({
      sql,
      args: [vectorJson, limit],
    });

    const dbDurationMs = performance.now() - queryStart;
    const totalDurationMs = performance.now() - startTime;

    const results: TezaraThesisDetails[] = [];
    for (const row of result.rows) {
      if (!row.id) continue;
      results.push(mapRowToDetails(row as unknown as Record<string, unknown>));
    }

    logger?.info("turso_vector_search_success", {
      service: "tezara",
      filePath: "src/features/tezara/index.ts",
      step: "search_turso_vector",
      durationMs: totalDurationMs,
      data: {
        query,
        resultCount: results.length,
        dbDurationMs: Math.round(dbDurationMs),
        limit,
      },
    });

    return results;
  } catch (err) {
    logger?.warn("turso_vector_fallback_to_keywords", {
      service: "tezara",
      filePath: "src/features/tezara/index.ts",
      step: "search_keyword_fallback",
      data: { query, reason: err instanceof Error ? err.message : String(err) },
    });

    try {
      const keywordResults = await searchThesesByKeywords(query, client, limit);
      return keywordResults;
    } catch (keywordErr) {
      const durationMs = performance.now() - startTime;
      logger?.error("turso_search_all_failed", {
        service: "tezara",
        filePath: "src/features/tezara/index.ts",
        step: "search_failed",
        durationMs,
        data: { query },
        error: keywordErr,
      });
      return [];
    }
  }
}
