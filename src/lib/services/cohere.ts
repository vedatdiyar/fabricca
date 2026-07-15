import type { LoggerInstance } from "@/lib/logger";
import { withRetry } from "@/lib/api-utils";
import type { ThesisMatrix, TezaraThesisSummary } from "@/lib/types";

const REQUEST_TIMEOUT_MS = 30_000;

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
 * Formats the thesis matrix into a YAML-structured query string for Cohere Rerank.
 *
 * The structured key-value format helps the cross-attention mechanism
 * distinguish between different semantic dimensions of the research.
 */
export function formatRerankQuery(matrix: ThesisMatrix): string {
  return [
    "Araştırma Matrisi:",
    `  Ana Aktörler: ${matrix.mainActors}`,
    `  Araştırma Odağı: ${matrix.researchFocus}`,
    `  Zaman Aralığı: ${matrix.temporalScope}`,
    `  Mekan: ${matrix.spatialScope}`,
    `  Kuramsal Çerçeve: ${matrix.theoreticalFramework}`,
    `  Yöntem: ${matrix.methodology}`,
    `  Ana İddia: ${matrix.mainClaim}`,
  ].join("\n");
}

/**
 * Formats raw TEZARA summaries into YAML-structured document strings
 * containing metadata (Title, University, Department, Year, Type) for Cohere Rerank.
 *
 * This structured metadata allows Cohere to match spatialScope (via university location),
 * temporalScope (via year), and other academic parameters.
 */
export function formatRerankDocuments(
  summaries: (TezaraThesisSummary & { abstract?: string })[],
): string[] {
  return summaries.map((s) => {
    const parts = [
      `Title: ${s.title}`,
      `University: ${s.university} (Turkey / Türkiye)`,
      `Department: ${s.department}`,
      `Year: ${s.year}`,
      `Type: ${s.thesisType}`,
    ];
    if (s.abstract) {
      parts.push(`Abstract: ${s.abstract}`);
    }
    return parts.join("\n");
  });
}

/**
 * Sends a YAML-structured query + document titles to Cohere Rerank v4 Pro
 * and returns the scored results sorted by descending relevance.
 *
 * The query and documents should be formatted via `formatRerankQuery()`
 * and `formatRerankDocuments()` respectively for optimal cross-attention.
 *
 * @param query - YAML-structured thesis matrix query string.
 * @param documents - YAML-formatted document strings (Title: ...).
 * @param log - Logger instance.
 * @returns Scored results sorted by descending relevance.
 */
export async function rerankTheses(
  query: string,
  documents: string[],
  log: LoggerInstance,
): Promise<CohereRerankResponse> {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    throw new Error("COHERE_API_KEY environment variable is not configured");
  }

  if (documents.length === 0) {
    return { results: [], searchUnits: 0 };
  }

  const startTime = performance.now();
  log.groupStart("cohere_rerank");

  const response = await withRetry(
    async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      );

      try {
        const res = await fetch("https://api.cohere.com/v2/rerank", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "X-Client-Name": "fabricca-originality-rerank",
          },
          body: JSON.stringify({
            model: "rerank-v4.0-pro",
            query,
            documents,
            top_n: documents.length,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP_STATUS_${res.status}`);
        }

        return res;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    {
      maxRetries: 3,
      baseDelay: 2000,
      isRetryable: (error) => {
        const errMsg = error instanceof Error ? error.message : String(error);
        if (errMsg.includes("HTTP_STATUS_429")) return true;
        if (errMsg.match(/HTTP_STATUS_5\d\d/)) return true;
        if (
          error instanceof TypeError ||
          (error instanceof Error && error.name === "AbortError")
        ) {
          return true;
        }
        return false;
      },
      onRetry: (attempt, delay, err) => {
        log.warn("cohere_rerank_retry", {
          service: "originality",
          data: {
            attempt,
            delayMs: Math.round(delay),
            error: err instanceof Error ? err.message : String(err),
          },
        });
      },
    },
  );

  const data = (await response.json()) as {
    id: string;
    results: { index: number; relevance_score: number }[];
    meta: { billed_units?: { search_units?: number } };
  };

  const durationMs = performance.now() - startTime;
  const searchUnits = data.meta?.billed_units?.search_units ?? 0;

  log.groupEnd("cohere_rerank", durationMs);

  return {
    results: data.results
      .map((r) => ({
        index: r.index,
        relevanceScore: r.relevance_score,
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore),
    searchUnits,
  };
}
