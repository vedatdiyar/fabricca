import { searchTezara } from "@/features/tezara";
import type { TezaraThesisDetails } from "@/lib/types";
import { rerankWithCohere, COHERE_RERANK_MODEL } from "@/services/ai/cohere";
import type { Logger } from "@/lib/logger";
import type { PositioningMatrixInput } from "./validation";

/** Candidate thesis extended with Cohere semantic relevance score. */
export interface SiftedThesis extends TezaraThesisDetails {
  relevanceScore?: number;
}

const ALLOWED_LANGUAGES = new Set([
  "tr",
  "tur",
  "turkish",
  "türkçe",
  "en",
  "eng",
  "english",
  "ingilizce",
]);

/**
 * Whether a thesis language tag matches Turkish or English; missing tags are kept.
 *
 * @param lang - The thesis language tag to check.
 * @returns True when the language is allowed or the tag is missing.
 */
function isAllowedLanguage(lang?: string): boolean {
  if (!lang || !lang.trim()) {
    return true;
  }
  const normalized = lang
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLowerCase()
    .trim();
  return ALLOWED_LANGUAGES.has(normalized);
}

/**
 * Sanitizes query text for vector search.
 *
 * @param rawQuery - The raw query string to sanitize.
 * @returns The cleaned query string.
 */
export function sanitizeSearchQuery(rawQuery: string): string {
  if (!rawQuery) return "";
  return rawQuery
    .replace(/\b(OR|AND|NOT)\b/gi, " ")
    .replace(/[+*?:^~={}[\]()"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Formats a thesis's title and abstract into a YAML document for reranking.
 *
 * @param thesis - The thesis to format.
 * @returns The formatted YAML string.
 */
function formatThesisToYaml(thesis: TezaraThesisDetails): string {
  return [`Title: ${thesis.title}`, `Abstract: ${thesis.abstract}`].join("\n");
}

import {
  generatePositioningQuery,
  type PositioningQuery,
} from "./query-generator";

/**
 * Formats the multi-aspect positioning query and matrix into a rich YAML query for Cohere cross-encoder reranking.
 *
 * @param query - The generated positioning query containing empirical sub-queries and substantive keywords.
 * @param input - The validated positioning matrix input.
 * @returns The formatted YAML query string.
 */
function formatMatrixToYamlQuery(
  query: PositioningQuery,
  input: PositioningMatrixInput,
): string {
  const lines = [
    `ResearchFocus: ${query.primaryEmpiricalQuery} ${query.actorsAndSourcesQuery}`,
    `SubstantiveKeywords: ${query.substantiveKeywords.join(", ")}`,
    `SubjectProblem: ${input.subjectProblem}`,
  ];
  return lines.join("\n");
}

/**
 * Merges multiple ranked candidate lists using Reciprocal Rank Fusion (RRF) to eliminate single-query blind spots.
 *
 * @param rankedLists - Array of thesis candidate lists.
 * @param k - Smoothing constant (default: 60).
 * @returns Deduplicated and fused list of theses.
 */
function reciprocalRankFusion(
  rankedLists: Array<TezaraThesisDetails[]>,
  k = 60,
): TezaraThesisDetails[] {
  const scoreMap = new Map<
    number,
    { thesis: TezaraThesisDetails; rrfScore: number }
  >();

  for (const list of rankedLists) {
    list.forEach((thesis, rank) => {
      const id = thesis.id;
      const current = scoreMap.get(id) || { thesis, rrfScore: 0 };
      current.rrfScore += 1 / (k + rank + 1);
      scoreMap.set(id, current);
    });
  }

  return Array.from(scoreMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map((item) => item.thesis);
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
  const filteredCandidates = fusedTheses.filter((thesis) => {
    const hasSufficientAbstract =
      thesis.abstract && thesis.abstract.trim().length >= 80;
    if (!hasSufficientAbstract) return false;

    const isValidLang = isAllowedLanguage(thesis.language);
    if (!isValidLang) return false;

    return true;
  });

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
