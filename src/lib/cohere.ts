import type { LoggerInstance } from "@/lib/logger";

/**
 * Raw result entry from the Cohere Rerank V2 API.
 */
export interface CohereRerankEntry {
  index: number;
  relevanceScore: number;
}

/**
 * Response shape from the Cohere Rerank V2 API.
 */
export interface CohereRerankResponse {
  results: CohereRerankEntry[];
  searchUnits: number;
}

/**
 * Sends thesis matrix query + raw thesis titles to Cohere Rerank v4 Pro
 * and returns the scored results without any filtering or sorting.
 *
 * Documents are the original TEZARA titles only — no author, university,
 * department, or year metadata. Titles retain both the Turkish and English
 * segments as a single string (e.g. "Türkçe Başlık / English Title") so
 * the multilingual model can leverage cross-attention on both languages.
 *
 * @param query - Structured thesis matrix fields as a single query string.
 * @param titles - Raw thesis titles from TezaraThesisSummary[].title.
 * @param log - Logger instance.
 * @returns Scored results with billed search_units.
 */
export async function rerankTheses(
  query: string,
  titles: string[],
  log: LoggerInstance,
): Promise<CohereRerankResponse> {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    throw new Error("COHERE_API_KEY environment variable is not configured");
  }

  if (titles.length === 0) {
    return { results: [], searchUnits: 0 };
  }

  log.info("cohere_rerank_start", {
    service: "originality",
    data: { documentCount: titles.length },
  });

  const startTime = performance.now();

  const response = await fetch("https://api.cohere.com/v2/rerank", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Client-Name": "fabricca-originality-rerank",
    },
    body: JSON.stringify({
      model: "rerank-v4.0-pro",
      query,
      documents: titles,
      top_n: titles.length,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error("cohere_rerank_failed", {
      service: "originality",
      error: errorText.slice(0, 500),
      data: { status: response.status, documentCount: titles.length },
    });
    throw new Error(
      `Cohere rerank failed (HTTP ${response.status}): ${errorText.slice(0, 500)}`,
    );
  }

  const data = (await response.json()) as {
    id: string;
    results: { index: number; relevance_score: number }[];
    meta: { billed_units?: { search_units?: number } };
  };

  const durationMs = performance.now() - startTime;
  const searchUnits = data.meta?.billed_units?.search_units ?? 0;

  log.info("cohere_rerank_success", {
    service: "originality",
    durationMs,
    data: {
      resultCount: data.results.length,
      searchUnits,
    },
  });

  return {
    results: data.results.map((r) => ({
      index: r.index,
      relevanceScore: r.relevance_score,
    })),
    searchUnits,
  };
}
