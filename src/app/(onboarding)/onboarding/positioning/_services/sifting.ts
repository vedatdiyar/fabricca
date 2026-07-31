import { searchTezara } from "@/lib/tezara";
import type { TezaraThesisDetails } from "@/lib/types";
import { rerankWithCohere } from "@/lib/services/cohere";
import type { Logger } from "@/lib/logger";
import type { PositioningMatrixInput } from "../_lib/validation";
import { sanitizeMeiliQuery, type GeneratedQueries } from "./queries";

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

/** Meilisearch filter to pre-filter results to Turkish or English only. */
const LANG_FILTER = "language=Türkçe OR language=English";

/** Fields to search within for relevance (title + abstract). */
const SEARCH_FIELDS = [
  "title_original",
  "title_translated",
  "abstract_original",
  "abstract_translated",
];

/** Minimum Meilisearch ranking score threshold to filter low-relevance hits. */
const RANKING_SCORE_THRESHOLD = 0.3;

/**
 * Validates whether a thesis language tag matches allowed languages (Turkish or English).
 * If no language tag is provided in metadata, the thesis is retained by default.
 *
 * @param lang - Raw language field from database hit.
 * @returns Boolean indicating whether the thesis language is allowed.
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
 * Converts a thesis candidate object into a compact YAML string (title + abstract only)
 * for Cohere Rerank v4.0 Pro. Light payload reduces latency and token usage.
 *
 * @param thesis - The candidate thesis object.
 * @returns Structured YAML string representation.
 */
function formatThesisToYaml(thesis: TezaraThesisDetails): string {
  return [`Title: ${thesis.title}`, `Abstract: ${thesis.abstract}`].join("\n");
}

/**
 * Converts user's 4-field positioning matrix into a structured YAML query string
 * for Cohere Rerank v4.0 Pro.
 *
 * @param input - The validated 4-field positioning matrix input.
 * @returns Structured YAML query string.
 */
function formatMatrixToYamlQuery(input: PositioningMatrixInput): string {
  return [
    `SubjectProblem: ${input.subjectProblem}`,
    `TheoreticalFramework: ${input.theoreticalFramework}`,
    `Methodology: ${input.methodology}`,
  ].join("\n");
}

/**
 * Executes 8 parallel Meilisearch queries on Tezara (single field: subjectProblem
 * × TR + EN × 4 alternatives, each query 2-4 focused keywords), deduplicates
 * results, applies abstract length and language filters, then ranks candidates
 * using Cohere Rerank v4 Pro.
 *
 * Fields queried: subjectProblem (actors and empirical context are now integral
 * to this field; ANALYSIS_ACTORS has been removed).
 * Methodology and theoreticalFramework are intentionally excluded.
 *
 * @param queries - Generated 8-query object (2 fields × TR + EN × 2 alternatives).
 * @param matrixInput - The 4-field positioning matrix input used as target context for reranking.
 * @param logger - Optional Logger instance for step telemetry.
 * @param options - Optional configuration options including topN (default 50).
 * @returns Promise resolving to an array of up to topN sifted and ranked theses.
 */
export async function searchAndSiftTheses(
  queries: GeneratedQueries,
  matrixInput: PositioningMatrixInput,
  logger?: Logger,
  options?: { topN?: number },
): Promise<SiftedThesis[]> {
  const topN = options?.topN ?? 50;

  const allQueries: string[] = [
    sanitizeMeiliQuery(queries.subjectTr_alt1),
    sanitizeMeiliQuery(queries.subjectTr_alt2),
    sanitizeMeiliQuery(queries.subjectTr_alt3),
    sanitizeMeiliQuery(queries.subjectTr_alt4),
    sanitizeMeiliQuery(queries.subjectEn_alt1),
    sanitizeMeiliQuery(queries.subjectEn_alt2),
    sanitizeMeiliQuery(queries.subjectEn_alt3),
    sanitizeMeiliQuery(queries.subjectEn_alt4),
  ];

  const searchStart = performance.now();

  logger?.info("sifting_parallel_search_start", {
    service: "tezara",
    filePath:
      "src/app/(onboarding)/onboarding/positioning/_services/sifting.ts",
    data: { queries: allQueries },
  });

  // Step 1: 8 parallel Meilisearch searches with precision params
  const searchParams = {
    limit: 50,
    rankingScoreThreshold: RANKING_SCORE_THRESHOLD,
    filter: LANG_FILTER,
    attributesToSearchOn: SEARCH_FIELDS,
  };

  const hitArrays = await Promise.all(
    allQueries.map((q) => searchTezara(q, logger, searchParams)),
  );

  // Step 2: Deduplicate by thesis ID — sort by ID for deterministic Cohere index mapping
  const candidateMap = new Map<number, TezaraThesisDetails>();
  for (const hits of hitArrays) {
    for (const thesis of hits) {
      if (thesis && thesis.id && !candidateMap.has(thesis.id)) {
        candidateMap.set(thesis.id, thesis);
      }
    }
  }

  const uniqueCandidates = Array.from(candidateMap.values()).sort(
    (a, b) => a.id - b.id,
  );

  // Step 3: Apply Abstract length (>= 100 chars) and Language filters (TR & EN only)
  const filteredCandidates = uniqueCandidates.filter((thesis) => {
    const hasSufficientAbstract =
      thesis.abstract && thesis.abstract.trim().length >= 100;
    if (!hasSufficientAbstract) return false;

    const isValidLang = isAllowedLanguage(thesis.language);
    if (!isValidLang) return false;

    return true;
  });

  if (filteredCandidates.length === 0) {
    logger?.info("sifting_no_candidates_remaining", {
      service: "tezara",
      filePath:
        "src/app/(onboarding)/onboarding/positioning/_services/sifting.ts",
      data: { queries: allQueries },
    });
    return [];
  }

  logger?.info("sifting_parallel_search_success", {
    service: "tezara",
    filePath:
      "src/app/(onboarding)/onboarding/positioning/_services/sifting.ts",
    durationMs: performance.now() - searchStart,
    data: { candidateCount: filteredCandidates.length },
  });

  // Step 4: Format target query as structured YAML string for Cohere Rerank
  const targetYamlQuery = formatMatrixToYamlQuery(matrixInput);

  // Step 5: Format candidate documents as structured YAML strings for Cohere Rerank
  const candidateYamlDocs = filteredCandidates.map(formatThesisToYaml);

  const rerankStart = performance.now();

  logger?.info("cohere_rerank_start", {
    service: "cohere",
    filePath:
      "src/app/(onboarding)/onboarding/positioning/_services/sifting.ts",
    data: {
      model: "rerank-v4.0-pro",
      candidateCount: filteredCandidates.length,
    },
  });

  // Step 6: Invoke Cohere Rerank API (rerank-v4.0-pro)
  const rerankResults = await rerankWithCohere({
    query: targetYamlQuery,
    documents: candidateYamlDocs,
    topN,
    logger,
  });

  // Step 7: Map rerank scores back to candidates and sort descending
  const siftedTheses: SiftedThesis[] = rerankResults.map((res) => {
    const candidate = filteredCandidates[res.index];
    return {
      ...candidate,
      relevanceScore: res.relevanceScore,
    };
  });

  siftedTheses.sort(
    (a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0),
  );

  const topResults = siftedTheses.slice(0, topN);

  logger?.info("cohere_rerank_success", {
    service: "cohere",
    filePath:
      "src/app/(onboarding)/onboarding/positioning/_services/sifting.ts",
    durationMs: performance.now() - rerankStart,
    data: { topCount: topResults.length },
  });

  return topResults;
}
