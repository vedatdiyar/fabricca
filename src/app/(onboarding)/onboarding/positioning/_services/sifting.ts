import { searchTheses } from "@/core/services/thesis-search";
import { searchOpenAlex } from "@/app/(onboarding)/onboarding/literature-review/_services/openalex/openalex-search";
import { searchSemanticScholarPapers } from "@/core/services/semantic-scholar/semantic-scholar-search";
import { searchExa, type ExaSearchResult } from "@/core/services/exa";
import { rerankWithCohere } from "@/core/services/ai/cohere";
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
  sourceChannel: "yok" | "openalex" | "semantic_scholar" | "exa";
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
 * 4-Channel Multi-Source Academic Sifting Engine:
 * 1. Generates 6 complementary queries (Qdrant, OpenAlex, Semantic Scholar, Exa) via FLASH_LITE_35.
 * 2. Fetches candidates in parallel from all 4 channels via Promise.all.
 * 3. Normalizes and deduplicates candidates into unified SiftedThesis models.
 * 4. Applies Cohere Rerank v4.0 Pro across the combined candidate pool.
 * 5. Returns sorted candidates ready for batch jury evaluation.
 *
 * @param matrixInput - The validated positioning matrix input.
 * @param logger - Optional structured logger.
 * @param options - Optional limits for topN, candidate retrieval, and parallel query distillation.
 * @returns Sorted candidate literature list across all 4 channels.
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

  // Parallel 4-Channel Search Execution
  const [
    [yokRes1, yokRes2],
    [openAlexRes1, openAlexRes2],
    semanticScholarRes,
    [exaDergiparkRes, exaFieldRes],
  ] = await Promise.all([
    // 1. Qdrant YÖK Theses (Empirical + Methodology Queries)
    (async () => {
      const t0 = performance.now();
      const [r1, r2] = await Promise.all([
        searchTheses(
          sanitizeSearchQuery(distilledQuery.thesisEmpiricalQuery),
          logger,
          { limit: 12, silent: true },
        ).catch(() => []),
        searchTheses(
          sanitizeSearchQuery(distilledQuery.thesisMethodologyQuery),
          logger,
          { limit: 12, silent: true },
        ).catch(() => []),
      ]);
      const totalCount = r1.length + r2.length;
      pipelineRun?.subStep(
        `YÖK Theses (Qdrant x2 · ${totalCount} candidates)`,
        performance.now() - t0,
      );
      return [r1, r2] as const;
    })(),

    // 2. OpenAlex Global Literature (Theoretical + Empirical Semantic Search)
    (async () => {
      const t0 = performance.now();
      const [r1, r2] = await Promise.all([
        searchOpenAlex(
          sanitizeSearchQuery(distilledQuery.globalTheoreticalQuery),
          8,
        ).catch(() => []),
        searchOpenAlex(
          sanitizeSearchQuery(distilledQuery.globalEmpiricalQuery),
          8,
        ).catch(() => []),
      ]);
      const totalCount = r1.length + r2.length;
      pipelineRun?.subStep(
        `OpenAlex (Global x2 · ${totalCount} papers)`,
        performance.now() - t0,
      );
      return [r1, r2] as const;
    })(),

    // 3. Semantic Scholar (High Impact / Influential Papers)
    (async () => {
      const t0 = performance.now();
      const res = await searchSemanticScholarPapers(
        sanitizeSearchQuery(distilledQuery.globalTheoreticalQuery),
        10,
      ).catch(() => []);
      pipelineRun?.subStep(
        `Semantic Scholar (${res.length} papers)`,
        performance.now() - t0,
      );
      return res;
    })(),

    // 4. Exa.ai (DergiPark Academic Papers + Field/Policy Context)
    (async () => {
      const t0 = performance.now();
      const [r1, r2] = await Promise.all([
        searchExa(distilledQuery.dergiparkQuery, {
          numResults: 6,
          includeDomains: ["dergipark.org.tr"],
          silent: true,
        }).catch(() => [] as ExaSearchResult[]),
        searchExa(distilledQuery.fieldWebQuery, {
          numResults: 6,
          silent: true,
        }).catch(() => [] as ExaSearchResult[]),
      ]);
      const totalCount = r1.length + r2.length;
      pipelineRun?.subStep(
        `Exa.ai (DergiPark & Web · ${totalCount} articles)`,
        performance.now() - t0,
      );
      return [r1, r2] as const;
    })(),
  ]);

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
      url:
        t.yokPdfUrl ||
        `https://tez.yok.gov.tr/UlusalTezMerkezi/tezDetay.jsp?id=${t.id}`,
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

    const authorsStr = (p.authors ?? []).slice(0, 3).join(", ") || "Bilinmiyor";
    const year = p.year || new Date().getFullYear();
    const abstractStr = p.abstract || "";
    const pubType = "Makale";

    candidates.push({
      id: p.openAlexId
        ? String(p.openAlexId).replace("https://openalex.org/", "")
        : `oa-${Math.random().toString(36).slice(2, 8)}`,
      title,
      author: authorsStr,
      university: p.publisher || "Uluslararası Akademik Yayın",
      year,
      thesisType: pubType,
      abstract: abstractStr,
      doi: p.doi || undefined,
      url: p.doi ? `https://doi.org/${p.doi}` : undefined,
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

    const authorsStr =
      (p.authors ?? [])
        .map((a) => a.name)
        .slice(0, 3)
        .join(", ") || "Bilinmiyor";
    const year = p.year || new Date().getFullYear();
    const abstractStr = p.abstract || "";

    const s2Type = (p.publicationTypes ?? []).includes("Book")
      ? "Kitap"
      : (p.publicationTypes ?? []).includes("BookSection")
        ? "Kitap Bölümü"
        : "Makale";

    candidates.push({
      id: `s2-${p.paperId}`,
      title,
      author: authorsStr,
      university: p.venue || "Uluslararası Hakemli Dergi",
      year,
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

  // Ingest Exa Results (DergiPark and Web)
  for (const r of [...exaDergiparkRes, ...exaFieldRes]) {
    const title = r.title || "";
    const key = normalizeTitleKey(title);
    if (!key || seenTitles.has(key)) continue;
    seenTitles.add(key);

    const text = (r.highlights ?? []).join(" ") || r.title || "";
    const isDergiPark = (r.url || "").includes("dergipark.org.tr");

    candidates.push({
      id: `exa-${Math.random().toString(36).slice(2, 8)}`,
      title,
      author:
        r.author || (isDergiPark ? "DergiPark Yazarı" : "Araştırmacı/Kurum"),
      university: isDergiPark
        ? "DergiPark Akademik Dergi"
        : "Saha & Sektörel Rapor",
      year: new Date().getFullYear(),
      thesisType: isDergiPark ? "Makale" : "Rapor",
      abstract: text,
      url: r.url,
      sourceChannel: "exa",
      publicationType: isDergiPark ? "Makale" : "Rapor",
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
      exaCount: candidates.filter((c) => c.sourceChannel === "exa").length,
    },
    hidden: true,
  });

  if (validCandidates.length === 0) {
    return [];
  }

  // Cohere Rerank v4.0 Pro
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

    const confident = scoredTheses.filter(
      (t) => (t.relevanceScore ?? 0) >= MIN_COHERE_RELEVANCE_SCORE,
    );

    // Ensure at least 6-8 candidates if available
    const finalSelected = (
      confident.length >= 6 ? confident : scoredTheses
    ).slice(0, topN);

    return finalSelected;
  } catch (err) {
    logger?.warn("cohere_rerank_fallback_to_raw", { error: err });
    return validCandidates.slice(0, topN);
  }
}
