import { parseOpenAlexMetadataResults } from "./parser";
import type { RefMetadata } from "../literature-review-papers";
import { openAlexQueue, fetchWithOpenAlexRetry } from "./openalex-http";

/**
 * Fetches reference metadata for a batch of OpenAlex work IDs.
 *
 * @param ids - The OpenAlex work IDs to fetch metadata for.
 * @param checkCancelled - Optional callback to abort the request.
 * @returns The fetched reference metadata records.
 */
export async function fetchOpenAlexMetadataBatch(
  ids: string[],
  checkCancelled?: () => boolean,
): Promise<RefMetadata[]> {
  if (ids.length === 0) return [];

  const apiKey = process.env.OPENALEX_API_KEY;
  const selectFields = "id,title,authorships,type,doi,language,cited_by_count";
  const results: RefMetadata[] = [];
  const BATCH_SIZE = 50;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    if (checkCancelled?.()) break;

    const batch = ids.slice(i, i + BATCH_SIZE);
    const idParams = batch
      .map((id) => id.replace("https://openalex.org/", ""))
      .join("|");

    const params = new URLSearchParams({
      filter: `openalex:${idParams}`,
      per_page: String(BATCH_SIZE),
      select: selectFields,
    });
    if (apiKey) params.set("api_key", apiKey);

    const url = `https://api.openalex.org/works?${params.toString().replace(/\+/g, "%20")}`;

    try {
      const response = (await openAlexQueue.exec(async () =>
        fetchWithOpenAlexRetry(url, checkCancelled),
      )) as Response | null;

      if (!response) continue;
      const data = (await response.json()) as {
        results?: Record<string, unknown>[];
      };
      if (!data.results) continue;

      const parsed = parseOpenAlexMetadataResults(data.results);
      results.push(...parsed);
    } catch {
      continue;
    }
  }

  return results;
}
