import type { RawPaper } from "../literature-review-papers";
import { semanticQueue, queryOpenAlexWorks } from "./openalex-http";

/**
 * Performs a semantic search against OpenAlex for the given query.
 *
 * @param query - The semantic search query text.
 * @param perPage - The number of results to request.
 * @param checkCancelled - Optional callback to abort the request.
 * @returns The matching raw papers.
 */
export async function searchOpenAlex(
  query: string,
  perPage: number,
  checkCancelled?: () => boolean,
): Promise<RawPaper[]> {
  const trimmedQuery = query.substring(0, 1000);
  const params = new URLSearchParams({
    "search.semantic": trimmedQuery,
    per_page: String(perPage),
    select:
      "id,title,type,authorships,relevance_score,doi,referenced_works,language,abstract_inverted_index,cited_by_count",
  });

  const apiKey = process.env.OPENALEX_API_KEY;
  if (apiKey) {
    params.set("api_key", apiKey);
  }

  return (await semanticQueue.exec(() =>
    queryOpenAlexWorks(params, checkCancelled),
  )) as RawPaper[];
}
