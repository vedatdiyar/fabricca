import type { RawPaper } from "../literature-review-papers";
import { semanticQueue, queryOpenAlexWorks } from "./openalex-http";

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
 * @returns Matching raw papers (empty when sanitized query < 3 chars).
 */
export async function searchOpenAlex(
  query: string,
  perPage: number,
  checkCancelled?: () => boolean,
  externalSignal?: AbortSignal,
): Promise<RawPaper[]> {
  // Sanitize: collapse whitespace/newlines, trim, enforce 1700-char URL safety margin (API max 2000)
  const sanitized = query.replace(/\s+/g, " ").trim().slice(0, 1700);
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
