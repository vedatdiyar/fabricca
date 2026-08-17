import { searchTezara } from "@/core/services/tezara";
import type { TezaraThesisDetails } from "@/lib/types";
import {
  rerankWithCohere,
  COHERE_RERANK_MODEL,
} from "@/core/services/ai/cohere";
import type { Logger } from "@/lib/logger";
import type { PositioningMatrixInput } from "./validation";
import { generatePositioningQuery } from "./query-generator";
import {
  sanitizeSearchQuery,
  formatThesisToYaml,
  formatMatrixToYamlQuery,
} from "./sifting-formatters";
import {
  reciprocalRankFusion,
  filterValidCandidates,
} from "./candidate-fusion";

export { sanitizeSearchQuery };

/** Candidate thesis extended with Cohere semantic relevance score. */
export interface SiftedThesis extends TezaraThesisDetails {
  relevanceScore?: number;
}

/** Difference threshold under which two relevance scores are treated as a tie. */
const SCORE_EPSILON = 1e-4;

/**
 * Ultra-fast multi-aspect direct semantic thesis sifting engine:
 * Extracts 3 complementary empirical focus queries via FLASH_LITE_31 purely from subjectProblem,
 * fetches candidate theses from Qdrant Cloud in parallel, fuses them via RRF, filters valid abstracts
 * and languages, and applies Cohere Rerank v4.0 Pro to sort the top-N candidates.
 *
 * @param matrixInput - The validated positioning matrix input.
 * @param logger - Optional structured logger for pipeline events.
 * @param options - Optional settings for topN and candidateLimit.
 * @returns The selected top theses sorted deterministically.
 */
export async function searchAndSiftTheses(
  matrixInput: PositioningMatrixInput,
  logger?: Logger,
  options?: { topN?: number; candidateLimit?: number },
): Promise<SiftedThesis[]> {
  const topN = options?.topN ?? 35;
  const singleQueryLimit = options?.candidateLimit ?? 100;

  const queryGenStart = performance.now();
  logger?.info("sifting_query_generation_start", {
    service: "gemini",
    filePath: "src/features/positioning/sifting.ts",
  });

  const distilledQuery = await generatePositioningQuery(matrixInput, logger);

  const query1 = sanitizeSearchQuery(
    distilledQuery.primaryEmpiricalQuery || matrixInput.subjectProblem,
  );
  const query2 = sanitizeSearchQuery(
    distilledQuery.actorsAndSourcesQuery || matrixInput.subjectProblem,
  );
  const query3 = sanitizeSearchQuery(
    distilledQuery.periodAndContextQuery || matrixInput.subjectProblem,
  );

  logger?.info("sifting_query_generation_success", {
    service: "gemini",
    filePath: "src/features/positioning/sifting.ts",
    durationMs: performance.now() - queryGenStart,
    data: {
      query1,
      query2,
      query3,
      keywords: distilledQuery.substantiveKeywords,
    },
  });

  const searchStart = performance.now();

  logger?.info("sifting_multi_search_start", {
    service: "tezara",
    filePath: "src/features/positioning/sifting.ts",
    data: { queries: [query1, query2, query3], singleQueryLimit },
  });

  // 1. Multi-Aspect Parallel Qdrant Searches
  const [res1, res2, res3] = await Promise.all([
    searchTezara(query1, logger, {
      limit: singleQueryLimit,
      silent: true,
    }),
    searchTezara(query2, logger, {
      limit: singleQueryLimit,
      silent: true,
    }),
    searchTezara(query3, logger, {
      limit: singleQueryLimit,
      silent: true,
    }),
  ]);

  // 2. Fuse candidate pools via Reciprocal Rank Fusion (RRF)
  const fusedTheses = reciprocalRankFusion([res1, res2, res3]);

  // 3. Filter valid candidates
  const filteredCandidates = filterValidCandidates(fusedTheses);

  if (filteredCandidates.length === 0) {
    logger?.info("sifting_multi_search_success", {
      service: "tezara",
      filePath: "src/features/positioning/sifting.ts",
      durationMs: performance.now() - searchStart,
      data: { candidateCount: 0 },
    });
    return [];
  }

  logger?.info("sifting_multi_search_success", {
    service: "tezara",
    filePath: "src/features/positioning/sifting.ts",
    durationMs: performance.now() - searchStart,
    data: { candidateCount: filteredCandidates.length },
  });

  // 4. Cohere Rerank v4.0 Pro
  const targetYamlQuery = formatMatrixToYamlQuery(distilledQuery, matrixInput);
  const candidateYamlDocs = filteredCandidates.map(formatThesisToYaml);

  const rerankStart = performance.now();

  logger?.info("sifting_rerank_start", {
    service: "cohere",
    filePath: "src/features/positioning/sifting.ts",
    data: {
      model: COHERE_RERANK_MODEL,
      candidateCount: filteredCandidates.length,
    },
  });

  const rerankResults = await rerankWithCohere({
    query: targetYamlQuery,
    documents: candidateYamlDocs,
    logger,
  });

  const scoredTheses: SiftedThesis[] = rerankResults.map((res) => {
    const candidate = filteredCandidates[res.index];
    return {
      ...candidate,
      relevanceScore: res.relevanceScore,
    };
  });

  scoredTheses.sort((a, b) => {
    const delta = (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0);
    if (Math.abs(delta) > SCORE_EPSILON) return delta;
    return a.id - b.id;
  });

  const selected = scoredTheses.slice(0, topN);

  logger?.info("sifting_rerank_success", {
    service: "cohere",
    filePath: "src/features/positioning/sifting.ts",
    durationMs: performance.now() - rerankStart,
    data: { topCount: selected.length },
  });

  return selected;
}
