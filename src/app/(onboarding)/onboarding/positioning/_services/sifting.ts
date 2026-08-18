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

/** Epsilon threshold for floating point tie-breaking. */
const SCORE_EPSILON = 1e-4;

/**
 * 3-Dimensional Academic Sifting Engine:
 * 1. Generates 3 complementary queries (Problem, Theory, Method) via FLASH_LITE_35.
 * 2. Fetches candidate theses from Qdrant vector index in parallel.
 * 3. Fuses candidate pools via Reciprocal Rank Fusion (RRF).
 * 4. Filters valid candidates (abstract length, non-empty metadata).
 * 5. Applies Cohere Rerank v4.0 Pro to sort and select the top candidates.
 *
 * @param matrixInput - The validated positioning matrix input.
 * @param logger - Optional structured logger.
 * @param options - Optional limits for topN and candidate retrieval.
 * @returns Sorted candidate theses list.
 */
export async function searchAndSiftTheses(
  matrixInput: PositioningMatrixInput,
  logger?: Logger,
  options?: { topN?: number; candidateLimit?: number },
): Promise<SiftedThesis[]> {
  const topN = options?.topN ?? 30;
  const singleQueryLimit = options?.candidateLimit ?? 100;

  const queryGenStart = performance.now();
  logger?.info("sifting_query_generation_start", {
    service: "gemini",
    filePath: "src/app/(onboarding)/onboarding/positioning/_services/sifting.ts",
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
    filePath: "src/app/(onboarding)/onboarding/positioning/_services/sifting.ts",
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
    filePath: "src/app/(onboarding)/onboarding/positioning/_services/sifting.ts",
    data: { queries: [query1, query2, query3], singleQueryLimit },
  });

  // 1. Parallel Multi-Aspect Vector Searches in Tezara (Qdrant E5)
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
      filePath: "src/app/(onboarding)/onboarding/positioning/_services/sifting.ts",
      durationMs: performance.now() - searchStart,
      data: { candidateCount: 0 },
    });
    return [];
  }

  logger?.info("sifting_multi_search_success", {
    service: "tezara",
    filePath: "src/app/(onboarding)/onboarding/positioning/_services/sifting.ts",
    durationMs: performance.now() - searchStart,
    data: { candidateCount: filteredCandidates.length },
  });

  // 4. Cohere Rerank v4.0 Pro
  const targetYamlQuery = formatMatrixToYamlQuery(distilledQuery, matrixInput);
  const candidateYamlDocs = filteredCandidates.map(formatThesisToYaml);

  const rerankStart = performance.now();

  logger?.info("sifting_rerank_start", {
    service: "cohere",
    filePath: "src/app/(onboarding)/onboarding/positioning/_services/sifting.ts",
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
    filePath: "src/app/(onboarding)/onboarding/positioning/_services/sifting.ts",
    durationMs: performance.now() - rerankStart,
    data: { topCount: selected.length },
  });

  return selected;
}
