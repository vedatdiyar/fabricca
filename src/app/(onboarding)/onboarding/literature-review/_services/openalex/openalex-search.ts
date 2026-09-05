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
const STOP_WORDS = new Set([
  "and",
  "or",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "the",
  "a",
  "an",
]);

const AUTHOR_NAME_PATTERN =
  /"([\p{Lu}\p{Lt}][\p{Ll}]+(?:\s+[\p{Lu}\p{Lt}]\.?)?\s+[\p{Lu}\p{Lt}][\p{Ll}]+(?:-[\p{Lu}\p{Lt}][\p{Ll}]+)?)"/gu;

/**
 * Lexical complement: OpenAlex stemmed and phrase `search` (100 req/s queue).
 * Executes targeted Anchor + Focus queries to recover canonical monographs,
 * authors, and specific case literature that dense vector search might dilute.
 *
 * When a quoted person/author name is detected (e.g. "Peter Ives", "Matthew Donoghue"),
 * it simultaneously queries OpenAlex's `filter=raw_author_name.search` in parallel
 * to ensure canonical author-produced works (whose titles/abstracts omit the author name)
 * are never missed.
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

  const apiKey = process.env.OPENALEX_API_KEY;
  const targetPerPage = Math.min(perPage, 20);

  // 1. Standard text search across title, abstract, and fulltext
  const standardParams = new URLSearchParams({
    search: sanitized,
    per_page: String(targetPerPage),
    select:
      "id,title,type,authorships,relevance_score,doi,referenced_works,language,abstract_inverted_index,cited_by_count,primary_location",
  });
  if (apiKey) standardParams.set("api_key", apiKey);

  const searchPromises: Promise<RawPaper[]>[] = [
    openAlexQueue.exec(() =>
      queryOpenAlexWorks(standardParams, checkCancelled, externalSignal),
    ) as Promise<RawPaper[]>,
  ];

  // 2. Parallel Author Search: detect quoted author names (e.g. "Peter Ives", "Daniel Egan")
  const authorMatches = [...sanitized.matchAll(AUTHOR_NAME_PATTERN)];
  for (const match of authorMatches) {
    const authorName = match[1];
    const rawRemaining = sanitized
      .replace(match[0], "")
      .replace(/["'()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const salientWords = rawRemaining
      .split(" ")
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()));
    // Use the primary salient anchor word (e.g. "language", "discourse", "maneuver")
    // and sort by citations to surface the author's most canonical works without over-constraining OpenAlex boolean AND
    const primaryKeyword = salientWords[0] || "";

    const authorParams = new URLSearchParams({
      filter: `raw_author_name.search:${authorName}`,
      sort: "cited_by_count:desc",
      per_page: String(targetPerPage),
      select:
        "id,title,type,authorships,relevance_score,doi,referenced_works,language,abstract_inverted_index,cited_by_count,primary_location",
    });
    if (primaryKeyword.length >= 3) {
      authorParams.set("search", primaryKeyword);
    }
    if (apiKey) authorParams.set("api_key", apiKey);

    searchPromises.push(
      openAlexQueue.exec(() =>
        queryOpenAlexWorks(authorParams, checkCancelled, externalSignal),
      ) as Promise<RawPaper[]>,
    );
  }

  const resultsArrays = await Promise.all(searchPromises);
  return dedupeRawPapers(resultsArrays.flat());
}

/**
 * Removes duplicate papers by OpenAlex ID, DOI, or lowercased title.
 *
 * @param papers - Raw papers from one or more OpenAlex responses.
 * @returns Unique papers preserving first-seen order.
 */
function dedupeRawPapers(papers: RawPaper[]): RawPaper[] {
  const seen = new Set<string>();
  const uniquePapers: RawPaper[] = [];
  for (const p of papers) {
    const key =
      p.openAlexId ||
      (p.doi ? p.doi.toLowerCase() : null) ||
      (p.title ? p.title.toLowerCase().trim() : null);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniquePapers.push(p);
  }
  return uniquePapers;
}

/**
 * Alias for `searchOpenAlexByTitleFilter` aligning with architectural naming standard
 * for OpenAlex 100 req/s high-speed lexical search.
 */
export const searchOpenAlexLexical = searchOpenAlexByTitleFilter;

/**
 * Book lane: same lexical `search` as the standard channel, but scoped to
 * `filter=type:book` and ranked by `cited_by_count:desc` so canonical monographs
 * surface even when tens of thousands of articles mention the same terms.
 * Because `search` only covers title/abstract/fulltext (never bylines), quoted
 * author names additionally run through `raw_author_name.search` scoped to books —
 * otherwise author-anchored queries could never match a book record.
 * Type is used here only for retrieval access, never for judging records.
 *
 * @param keywordQuery - Keyword/phrase query (3-250 chars).
 * @param perPage - Number of book results to request per branch (default 10, capped at 25).
 * @param checkCancelled - Optional callback to abort the request.
 * @param externalSignal - Optional abort signal.
 * @returns Matching book papers (empty when query < 3 chars).
 */
export async function searchOpenAlexBooks(
  keywordQuery: string,
  perPage = 10,
  checkCancelled?: () => boolean,
  externalSignal?: AbortSignal,
): Promise<RawPaper[]> {
  const sanitized = keywordQuery.replace(/\s+/g, " ").trim().slice(0, 250);
  if (sanitized.length < 3) return [];

  const apiKey = process.env.OPENALEX_API_KEY;
  const targetPerPage = Math.min(Math.max(perPage, 1), 25);
  const selectFields =
    "id,title,type,authorships,relevance_score,doi,referenced_works,language,abstract_inverted_index,cited_by_count,primary_location";

  const searchPromises: Promise<RawPaper[]>[] = [];

  // 1. Keyword search scoped to books, most-cited first
  const keywordParams = new URLSearchParams({
    search: sanitized,
    filter: "type:book",
    sort: "cited_by_count:desc",
    per_page: String(targetPerPage),
    select: selectFields,
  });
  if (apiKey) keywordParams.set("api_key", apiKey);
  searchPromises.push(
    openAlexQueue.exec(() =>
      queryOpenAlexWorks(keywordParams, checkCancelled, externalSignal),
    ) as Promise<RawPaper[]>,
  );

  // 2. Author branch: quoted person names match bylines (search never sees authors),
  // scoped to books and ranked by citations to surface the author's monographs.
  const authorMatches = [...sanitized.matchAll(AUTHOR_NAME_PATTERN)];
  for (const match of authorMatches) {
    const authorName = match[1];
    const authorParams = new URLSearchParams({
      filter: `raw_author_name.search:"${authorName}",type:book`,
      sort: "cited_by_count:desc",
      per_page: String(targetPerPage),
      select: selectFields,
    });
    if (apiKey) authorParams.set("api_key", apiKey);
    searchPromises.push(
      openAlexQueue.exec(() =>
        queryOpenAlexWorks(authorParams, checkCancelled, externalSignal),
      ) as Promise<RawPaper[]>,
    );
  }

  const resultsArrays = await Promise.all(searchPromises);
  return dedupeRawPapers(resultsArrays.flat());
}

