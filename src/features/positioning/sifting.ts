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

/**
 * Formats the positioning matrix input into a YAML query for reranking.
 *
 * @param input - The validated positioning matrix input.
 * @returns The formatted YAML query string.
 */
function formatMatrixToYamlQuery(input: PositioningMatrixInput): string {
  return `SubjectProblem: ${input.subjectProblem}`;
}

/** Difference threshold under which two relevance scores are treated as a tie. */
const SCORE_EPSILON = 1e-4;

/**
 * Ultra-fast direct semantic thesis sifting engine:
 * Directly vectorizes the thesis research problem, fetches top candidates from Qdrant Cloud
 * in a single high-speed vector query, filters abstracts, and uses Cohere Rerank v4.0 Pro
 * (cross-encoder) to select and rank the most relevant top-N theses.
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
  const topN = options?.topN ?? 45;
  const candidateLimit = options?.candidateLimit ?? 400;

  const searchQuery = sanitizeSearchQuery(
    matrixInput.subjectProblem.slice(0, 500),
  );

  const searchStart = performance.now();

  logger?.info("sifting_direct_search_start", {
    service: "tezara",
    filePath: "src/features/positioning/sifting.ts",
    data: { query: searchQuery, candidateLimit },
  });

  // 1. Single Ultra-Fast Qdrant Query with candidateLimit (default 400)
  const rawTheses = await searchTezara(searchQuery, logger, {
    limit: candidateLimit,
  });

  // 2. Filter valid candidates
  const filteredCandidates = rawTheses.filter((thesis) => {
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
      filePath: "src/features/positioning/sifting.ts",
      data: { query: searchQuery },
    });
    return [];
  }

  logger?.info("sifting_direct_search_success", {
    service: "tezara",
    filePath: "src/features/positioning/sifting.ts",
    durationMs: performance.now() - searchStart,
    data: { candidateCount: filteredCandidates.length },
  });

  // 3. Cohere Rerank v4.0 Pro
  const targetYamlQuery = formatMatrixToYamlQuery(matrixInput);
  const candidateYamlDocs = filteredCandidates.map(formatThesisToYaml);

  const rerankStart = performance.now();

  logger?.info("cohere_rerank_start", {
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

  logger?.info("cohere_rerank_success", {
    service: "cohere",
    filePath: "src/features/positioning/sifting.ts",
    durationMs: performance.now() - rerankStart,
    data: { topCount: selected.length },
  });

  return selected;
}
