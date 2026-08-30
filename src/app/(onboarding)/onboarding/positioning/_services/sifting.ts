import { searchTheses } from "@/core/services/thesis-search";
import { searchOpenAlex } from "@/app/(onboarding)/onboarding/literature-review/_services/openalex/openalex-search";
import { searchSemanticScholarPapers } from "@/core/services/semantic-scholar/semantic-scholar-search";
import { rerankWithCohere } from "@/core/services/ai/cohere";
import { buildYokThesisUrl } from "@/core/config/endpoints";
import type { Logger } from "@/lib/logger";
import type { PipelineRun } from "@/lib/pipeline-logger";
import type { PositioningMatrixInput } from "./validation";
import {
  generatePositioningQuery,
  type MultiSourcePositioningQuery,
} from "./query-generator";
import {
  sanitizeSearchQuery,
  formatThesisToYaml,
  formatMatrixToYamlQuery,
} from "./sifting-formatters";

export { sanitizeSearchQuery };

/** Candidate literature item extended with Cohere semantic relevance score. */
export interface SiftedThesis {
  id: string;
  title: string;
  author: string;
  university: string;
  year: number;
  thesisType: string;
  department?: string;
  abstract: string;
  url?: string;
  doi?: string;
  sourceChannel: "yok" | "openalex" | "semantic_scholar";
  publicationType: "Tez" | "Makale" | "Kitap" | "Kitap Bölümü" | "Rapor";
  relevanceScore?: number;
}

/** Epsilon threshold for floating point tie-breaking. */
const SCORE_EPSILON = 1e-4;

/** Minimum Cohere Rerank v4.0 relevance score to filter out irrelevant/noisy candidates. */
export const MIN_COHERE_RELEVANCE_SCORE = 0.45;

/** Minimum abstract character length for candidate evaluation. */
const MIN_ABSTRACT_LENGTH = 40;

/**
 * 3-Channel Multi-Source Academic Sifting Engine:
 * 1. Generates complementary queries (Qdrant, OpenAlex, Semantic Scholar) via FLASH_LITE_35.
 * 2. Fetches candidates in parallel from all 3 academic channels via Promise.all.
 * 3. Normalizes and deduplicates candidates into unified SiftedThesis models.
 * 4. Applies Cohere Rerank v4.0 Pro across the combined candidate pool.
 * 5. Returns sorted candidates ready for batch jury evaluation.
 *
 * @param matrixInput - The validated positioning matrix input.
 * @param logger - Optional structured logger.
 * @param options - Optional limits for topN, candidate retrieval, and parallel query distillation.
 * @returns Sorted candidate literature list across all 3 academic channels.
 */
export async function searchAndSiftTheses(
  matrixInput: PositioningMatrixInput,
  logger?: Logger,
  options?: {
    topN?: number;
    candidateLimit?: number;
    pipelineRun?: PipelineRun;
    queryPromise?: Promise<MultiSourcePositioningQuery>;
    queryStartTime?: number;
  },
): Promise<SiftedThesis[]> {
  const topN = options?.topN ?? 20;
  const pipelineRun = options?.pipelineRun;

  const queryGenStart = options?.queryStartTime ?? performance.now();
  const distilledQuery = options?.queryPromise
    ? await options.queryPromise
    : await generatePositioningQuery(matrixInput, logger);

  pipelineRun?.subStep(
    "Query Distillation (Gemini Flash)",
    performance.now() - queryGenStart,
  );

  logger?.info("multi_source_sifting_query_gen_success", {
    service: "gemini",
    filePath:
      "src/app/(onboarding)/onboarding/positioning/_services/sifting.ts",
    durationMs: performance.now() - queryGenStart,
    hidden: true,
  });

  const searchStart = performance.now();

  const { yokResults, openAlexResults, s2Results } = await fetchAllChannels(
    distilledQuery,
    logger,
    pipelineRun,
  );
  const [[yokRes1, yokRes2], [openAlexRes1, openAlexRes2], semanticScholarRes] = [
    yokResults,
    openAlexResults,
    s2Results,
  ] as const;

  const candidates: SiftedThesis[] = [];
  const seenTitles = new Set<string>();

  const normalizeTitleKey = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^a-z0-9ğüşıöç]/gi, "")
      .slice(0, 40);

  // Ingest YÖK Theses
  for (const t of [...yokRes1, ...yokRes2]) {
    const key = normalizeTitleKey(t.title);
    if (!key || seenTitles.has(key)) continue;
    seenTitles.add(key);

    candidates.push({
      id: `yok-${t.id}`,
      title: t.title,
      author: t.author || "Bilinmiyor",
      university: t.university || "Türkiye Üniversiteleri",
      year: t.year || new Date().getFullYear(),
      thesisType: t.thesisType || "Doktora/Yüksek Lisans Tezi",
      department: t.department,
      abstract: t.abstract || "",
      url: t.yokPdfUrl || buildYokThesisUrl(t.id),
      sourceChannel: "yok",
      publicationType: "Tez",
    });
  }

  // Ingest OpenAlex Papers
  for (const p of [...openAlexRes1, ...openAlexRes2]) {
    const title = p.title || "";
    const key = normalizeTitleKey(title);
    if (!key || seenTitles.has(key)) continue;
    seenTitles.add(key);

    const abstractStr = p.abstract || "";
    const pubType: "Tez" | "Makale" | "Kitap" | "Kitap Bölümü" | "Rapor" =
      p.publicationType === "Tez" ||
      p.publicationType === "Kitap" ||
      p.publicationType === "Kitap Bölümü" ||
      p.publicationType === "Rapor"
        ? p.publicationType
        : "Makale";

    candidates.push({
      id: `openalex-${p.openAlexId || Math.random().toString(36).slice(2, 8)}`,
      title,
      author:
        p.authors && p.authors.length > 0 ? p.authors.join(", ") : "Bilinmiyor",
      university: p.publisher || "Uluslararası Akademik Yayın",
      year: p.year || new Date().getFullYear(),
      thesisType: pubType,
      abstract: abstractStr,
      doi: p.doi || undefined,
      url: p.url || (p.doi ? `https://doi.org/${p.doi}` : undefined),
      sourceChannel: "openalex",
      publicationType: pubType,
    });
  }

  // Ingest Semantic Scholar Papers
  for (const p of semanticScholarRes) {
    const title = p.title || "";
    const key = normalizeTitleKey(title);
    if (!key || seenTitles.has(key)) continue;
    seenTitles.add(key);

    const abstractStr = p.abstract || "";
    const isBook = (p.publicationTypes ?? []).includes("Book");
    const isSection = (p.publicationTypes ?? []).includes("BookSection");
    const s2Type = isBook ? "Kitap" : isSection ? "Kitap Bölümü" : "Makale";

    candidates.push({
      id: `s2-${p.paperId || Math.random().toString(36).slice(2, 8)}`,
      title,
      author:
        p.authors && p.authors.length > 0
          ? p.authors.map((a) => a.name).join(", ")
          : "Bilinmiyor",
      university: p.venue || "Uluslararası Akademik Yayın",
      year: p.year || new Date().getFullYear(),
      thesisType: s2Type,
      abstract: abstractStr,
      doi: p.externalIds?.DOI,
      url:
        p.url ||
        (p.externalIds?.DOI
          ? `https://doi.org/${p.externalIds.DOI}`
          : undefined),
      sourceChannel: "semantic_scholar",
      publicationType: s2Type,
    });
  }

  // Filter candidates with minimum viable abstract content
  const validCandidates = candidates.filter(
    (c) => c.abstract.trim().length >= MIN_ABSTRACT_LENGTH,
  );

  logger?.info("multi_source_search_completed", {
    service: "thesis-search",
    filePath:
      "src/app/(onboarding)/onboarding/positioning/_services/sifting.ts",
    durationMs: performance.now() - searchStart,
    data: {
      totalFound: candidates.length,
      validFound: validCandidates.length,
      yokCount: candidates.filter((c) => c.sourceChannel === "yok").length,
      openAlexCount: candidates.filter((c) => c.sourceChannel === "openalex")
        .length,
      s2Count: candidates.filter((c) => c.sourceChannel === "semantic_scholar")
        .length,
    },
    hidden: true,
  });

  if (validCandidates.length === 0) return [];

  return rerankCandidates(validCandidates, distilledQuery, matrixInput, logger, pipelineRun, topN);
}

// ── Channel fetchers ──

async function fetchQdrantChannel(
  distilledQuery: MultiSourcePositioningQuery,
  logger: Logger | undefined,
  pipelineRun: PipelineRun | undefined,
) {
  const t0 = performance.now();
  const [r1, r2] = await Promise.all([
    searchTheses(sanitizeSearchQuery(distilledQuery.thesisEmpiricalQuery), logger, {
      limit: 12,
      silent: true,
    }).catch((err) => {
      logger?.warn("sifting_qdrant_channel_error", { service: "thesis-search", error: err });
      return [];
    }),
    searchTheses(sanitizeSearchQuery(distilledQuery.thesisMethodologyQuery), logger, {
      limit: 12,
      silent: true,
    }).catch((err) => {
      logger?.warn("sifting_qdrant_channel_error", { service: "thesis-search", error: err });
      return [];
    }),
  ]);
  pipelineRun?.subStep(`YÖK Theses (Qdrant x2 · ${r1.length + r2.length} candidates)`, performance.now() - t0);
  return [r1, r2] as const;
}

async function fetchOpenAlexChannel(
  distilledQuery: MultiSourcePositioningQuery,
  logger: Logger | undefined,
  pipelineRun: PipelineRun | undefined,
) {
  const t0 = performance.now();
  const [r1, r2] = await Promise.all([
    searchOpenAlex(sanitizeSearchQuery(distilledQuery.globalTheoreticalQuery), 8).catch((err) => {
      logger?.warn("sifting_openalex_channel_error", { service: "openalex", error: err });
      return [];
    }),
    searchOpenAlex(sanitizeSearchQuery(distilledQuery.globalEmpiricalQuery), 8).catch((err) => {
      logger?.warn("sifting_openalex_channel_error", { service: "openalex", error: err });
      return [];
    }),
  ]);
  pipelineRun?.subStep(`OpenAlex (Global x2 · ${r1.length + r2.length} papers)`, performance.now() - t0);
  return [r1, r2] as const;
}

async function fetchSemanticScholarChannel(
  distilledQuery: MultiSourcePositioningQuery,
  logger: Logger | undefined,
  pipelineRun: PipelineRun | undefined,
) {
  const t0 = performance.now();
  const res = await searchSemanticScholarPapers(
    sanitizeSearchQuery(distilledQuery.globalTheoreticalQuery),
    10,
  ).catch((err) => {
      logger?.warn("sifting_s2_channel_error", { service: "thesis-search", error: err });
      return [];
    });
  pipelineRun?.subStep(`Semantic Scholar (${res.length} papers)`, performance.now() - t0);
  return res;
}

async function fetchAllChannels(
  distilledQuery: MultiSourcePositioningQuery,
  logger: Logger | undefined,
  pipelineRun: PipelineRun | undefined,
) {
  const [yokResults, openAlexResults, s2Results] = await Promise.all([
    fetchQdrantChannel(distilledQuery, logger, pipelineRun),
    fetchOpenAlexChannel(distilledQuery, logger, pipelineRun),
    fetchSemanticScholarChannel(distilledQuery, logger, pipelineRun),
  ]);
  return { yokResults, openAlexResults, s2Results };
}

// ── Reranking ──

async function rerankCandidates(
  validCandidates: SiftedThesis[],
  distilledQuery: MultiSourcePositioningQuery,
  matrixInput: PositioningMatrixInput,
  logger: Logger | undefined,
  pipelineRun: PipelineRun | undefined,
  topN: number,
): Promise<SiftedThesis[]> {
  const targetYamlQuery = formatMatrixToYamlQuery(distilledQuery, matrixInput);
  const candidateYamlDocs = validCandidates.map((c) => formatThesisToYaml(c));

  try {
    const cohereStart = performance.now();
    const rerankResults = await rerankWithCohere({
      query: targetYamlQuery,
      documents: candidateYamlDocs,
      logger,
      silent: true,
    });
    pipelineRun?.subStep(
      `Cohere Rerank v4.0 Pro (${validCandidates.length} candidates)`,
      performance.now() - cohereStart,
    );

    const scoredTheses: SiftedThesis[] = rerankResults.map((res) => ({
      ...validCandidates[res.index],
      relevanceScore: res.relevanceScore,
    }));

    scoredTheses.sort((a, b) => {
      const delta = (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0);
      if (Math.abs(delta) > SCORE_EPSILON) return delta;
      return 0;
    });

    const confident = scoredTheses.filter((t) => (t.relevanceScore ?? 0) >= MIN_COHERE_RELEVANCE_SCORE);
    const finalSelected = (confident.length >= 6 ? confident : scoredTheses).slice(0, topN);
    return finalSelected;
  } catch (err) {
    logger?.warn("cohere_rerank_fallback_to_raw", { error: err });
    return validCandidates.slice(0, topN);
  }
}
