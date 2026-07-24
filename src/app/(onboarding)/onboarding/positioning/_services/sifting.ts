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
 * Converts a thesis candidate object into a structured YAML string for optimal performance
 * with Cohere Rerank v4.0 Pro per official Cohere documentation.
 *
 * @param thesis - The candidate thesis object.
 * @returns Structured YAML string representation.
 */
function formatThesisToYaml(thesis: TezaraThesisDetails): string {
  return [
    `Title: ${thesis.title}`,
    `Author: ${thesis.author || "N/A"}`,
    `University: ${thesis.university || "N/A"}`,
    `Year: ${thesis.year || "N/A"}`,
    `ThesisType: ${thesis.thesisType || "N/A"}`,
    `Department: ${thesis.department || "N/A"}`,
    `Abstract: ${thesis.abstract}`,
  ].join("\n");
}

/**
 * Converts user's 5-field positioning matrix into a structured YAML query string
 * for Cohere Rerank v4.0 Pro.
 *
 * @param input - The validated 5-field positioning matrix input.
 * @returns Structured YAML query string.
 */
function formatMatrixToYamlQuery(input: PositioningMatrixInput): string {
  return [
    `SubjectAndProblem: ${input.subjectAndProblem}`,
    `TheoreticalFramework: ${input.theoreticalFramework}`,
    `UnitOfAnalysis: ${input.unitOfAnalysis}`,
    `Methodology: ${input.methodology}`,
    `ScopeAndContext: ${input.scopeAndContext}`,
  ].join("\n");
}

/**
 * Executes 3-tier parallel Meilisearch queries on Tezara, deduplicates and sifts results
 * through abstract length and language filters, and ranks candidates using Cohere Rerank v4 Pro
 * formatted as structured YAML to select the TOP 12 most relevant theses.
 *
 * @param queries - Generated 3-tier search queries (direct, expanded, conceptual).
 * @param matrixInput - The 5-field positioning matrix input used as target context for reranking.
 * @param logger - Optional Logger instance for step telemetry.
 * @param options - Optional configuration options including topN (default 12).
 * @returns Promise resolving to an array of up to topN sifted and ranked theses.
 */
export async function searchAndSiftTheses(
  queries: GeneratedQueries,
  matrixInput: PositioningMatrixInput,
  logger?: Logger,
  options?: { topN?: number },
): Promise<SiftedThesis[]> {
  const startTime = performance.now();
  const topN = options?.topN ?? 12;

  const cleanDirect = sanitizeMeiliQuery(queries.directQuery);
  const cleanExpanded = sanitizeMeiliQuery(queries.expandedQuery);
  const cleanConceptual = sanitizeMeiliQuery(queries.conceptualQuery);

  logger?.info("sifting_parallel_search_start", {
    service: "tezara",
    filePath:
      "src/app/(onboarding)/onboarding/positioning/_services/sifting.ts",
    data: {
      queries: {
        directQuery: cleanDirect,
        expandedQuery: cleanExpanded,
        conceptualQuery: cleanConceptual,
      },
    },
  });

  // Step 1: Parallel search on Tezara with Meilisearch-sanitized queries (limit: 150 per query)
  const [directHits, expandedHits, conceptualHits] = await Promise.all([
    searchTezara(cleanDirect, logger, { limit: 150 }),
    searchTezara(cleanExpanded, logger, { limit: 150 }),
    searchTezara(cleanConceptual, logger, { limit: 150 }),
  ]);

  // Step 2: Deduplicate candidate theses by thesis ID
  const candidateMap = new Map<number, TezaraThesisDetails>();
  for (const thesis of [...directHits, ...expandedHits, ...conceptualHits]) {
    if (thesis && thesis.id && !candidateMap.has(thesis.id)) {
      candidateMap.set(thesis.id, thesis);
    }
  }

  const uniqueCandidates = Array.from(candidateMap.values());

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
    logger?.warn("sifting_no_candidates_remaining", {
      service: "tezara",
      filePath:
        "src/app/(onboarding)/onboarding/positioning/_services/sifting.ts",
      data: { cleanDirect, cleanExpanded, cleanConceptual },
    });
    return [];
  }

  // Step 4: Format target query as structured YAML string for Cohere Rerank v4.0 Pro
  const targetYamlQuery = formatMatrixToYamlQuery(matrixInput);

  // Step 5: Format candidate documents as structured YAML strings for Cohere Rerank v4.0 Pro
  const candidateYamlDocs = filteredCandidates.map(formatThesisToYaml);

  // Step 6: Invoke Cohere Rerank v4 Pro API with structured YAML payload
  const rerankResults = await rerankWithCohere({
    query: targetYamlQuery,
    documents: candidateYamlDocs,
    topN,
    model: "rerank-v4.0-pro",
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

  logger?.info("sifting_parallel_search_success", {
    service: "positioning",
    filePath:
      "src/app/(onboarding)/onboarding/positioning/_services/sifting.ts",
    durationMs: performance.now() - startTime,
    data: {
      candidatesPassedToRerank: filteredCandidates.length,
      topCount: topResults.length,
    },
  });

  return topResults;
}
