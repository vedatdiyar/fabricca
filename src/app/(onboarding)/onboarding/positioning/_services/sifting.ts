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

/** Whether a thesis language tag matches Turkish or English; missing tags are kept. */
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

function formatThesisToYaml(thesis: TezaraThesisDetails): string {
  return [`Title: ${thesis.title}`, `Abstract: ${thesis.abstract}`].join("\n");
}

function formatMatrixToYamlQuery(input: PositioningMatrixInput): string {
  return [
    `SubjectProblem: ${input.subjectProblem}`,
    `TheoreticalFramework: ${input.theoreticalFramework}`,
    `Methodology: ${input.methodology}`,
  ].join("\n");
}

/**
 * Runs 8 parallel Meilisearch queries on Tezara, deduplicates results, applies
 * abstract length and language filters, then ranks candidates via Cohere Rerank
 * v4 Pro. Only subjectProblem is queried; methodology and theoreticalFramework
 * are intentionally excluded.
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

  const searchParams = {
    limit: 50,
    rankingScoreThreshold: RANKING_SCORE_THRESHOLD,
    filter: LANG_FILTER,
    attributesToSearchOn: SEARCH_FIELDS,
  };

  const hitArrays = await Promise.all(
    allQueries.map((q) => searchTezara(q, logger, searchParams)),
  );

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

  const targetYamlQuery = formatMatrixToYamlQuery(matrixInput);
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

  const rerankResults = await rerankWithCohere({
    query: targetYamlQuery,
    documents: candidateYamlDocs,
    topN,
    logger,
  });

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
