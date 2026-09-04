import type { RawPaper } from "../literature-review-papers";
import {
  openAlexQueue,
  semanticQueue,
  queryOpenAlexWorks,
} from "./openalex-http";

/**
 * ARCHITECTURE SEAL — OpenAlex Text-Only Semantic Interface
 *
 * OpenAlex maintains its own server-side embedding space (GTE Large EN, 1024d).
 * This module is a **pure-text** bridge: the caller sends only a sanitized `string`
 * (`search.semantic`) and OpenAlex embeds it internally. No client-side vector
 * (`number[]`) from any local model — `intfloat/multilingual-e5-base` (768d) or
 * `@cf/baai/bge-m3` (1024d) — is ever produced, accepted, or forwarded here.
 * Passing a numeric embedding to this interface is an architectural violation.
 * Vector isolation: HF E5 and Cloudflare BGE-M3 are used exclusively for Qdrant
 * (`theses` 768d/Cosine) and pgvector (`chunks` 1024d) respectively; they never
 * enter the OpenAlex call path.
 */

/**
 * Performs a semantic search against OpenAlex for the given query.
 * Strictly `string`-typed — this interface never accepts `number[]` embeddings.
 *
 * @param query - Semantic search query text (raw, will be sanitized).
 * @param perPage - Number of results to request.
 * @param checkCancelled - Optional callback to abort the request.
 * @param externalSignal - Optional abort signal.
 * @returns Matching raw papers (empty when sanitized query < 3 chars).
 */
export async function searchOpenAlex(
  query: string,
  perPage: number,
  checkCancelled?: () => boolean,
  externalSignal?: AbortSignal,
): Promise<RawPaper[]> {
  // Sanitize: collapse whitespace/newlines, trim, enforce 1500-char API limit (free plan)
  const sanitized = query.replace(/\s+/g, " ").trim().slice(0, 1500);
  if (sanitized.length < 3) return [];
  const trimmedQuery = sanitized;
  const params = new URLSearchParams({
    "search.semantic": trimmedQuery,
    per_page: String(perPage),
    select:
      "id,title,type,authorships,relevance_score,doi,referenced_works,language,abstract_inverted_index,cited_by_count,primary_location",
  });

  const apiKey = process.env.OPENALEX_API_KEY;
  if (apiKey) {
    params.set("api_key", apiKey);
  }

  return (await semanticQueue.exec(() =>
    queryOpenAlexWorks(params, checkCancelled, externalSignal),
  )) as RawPaper[];
}

/**
 * Lexical complement: OpenAlex stemmed and phrase `search` (100 req/s queue).
 * Executes targeted Anchor + Focus queries to recover canonical monographs,
 * authors, and specific case literature that dense vector search might dilute.
 *
 * @param keywordQuery - Keyword/phrase query (3-250 chars).
 * @param perPage - Number of results to request (capped at 20).
 * @param checkCancelled - Optional callback to abort the request.
 * @param externalSignal - Optional abort signal.
 * @returns Matching raw papers (empty when query < 3 chars).
 */
export async function searchOpenAlexByTitleFilter(
  keywordQuery: string,
  perPage: number,
  checkCancelled?: () => boolean,
  externalSignal?: AbortSignal,
): Promise<RawPaper[]> {
  const sanitized = keywordQuery.replace(/\s+/g, " ").trim().slice(0, 250);
  if (sanitized.length < 3) return [];
  const params = new URLSearchParams({
    search: sanitized,
    per_page: String(Math.min(perPage, 20)),
    select:
      "id,title,type,authorships,relevance_score,doi,referenced_works,language,abstract_inverted_index,cited_by_count,primary_location",
  });

  const apiKey = process.env.OPENALEX_API_KEY;
  if (apiKey) params.set("api_key", apiKey);

  return (await openAlexQueue.exec(() =>
    queryOpenAlexWorks(params, checkCancelled, externalSignal),
  )) as RawPaper[];
}

/**
 * Alias for `searchOpenAlexByTitleFilter` aligning with architectural naming standard
 * for OpenAlex 100 req/s high-speed lexical search.
 */
export const searchOpenAlexLexical = searchOpenAlexByTitleFilter;

