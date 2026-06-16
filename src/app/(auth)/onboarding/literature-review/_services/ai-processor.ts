import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/gemini";
import {
  buildLiteratureSiftingPrompt,
  buildLiteratureJuryAnalysisPrompt,
  literatureSiftingSchema,
  literatureJuryAnalysisSchema,
  LITERATURE_SIFTING_SYSTEM_INSTRUCTION,
  LITERATURE_JURY_ANALYSIS_SYSTEM_INSTRUCTION,
} from "@/lib/prompts";
import { Logger } from "@/lib/logger";
import type { SubBoxInput, ValidatedPaper } from "@/lib/literature-review-papers";
import type { JuryArticle } from "@/lib/types";
import { validateWithCrossRef } from "./search-api";

// ============================================================================
// Literature Review Result Types
// ============================================================================

export interface LiteratureReviewResult {
  starterPack: JuryArticle[];
  reservedPool: JuryArticle[];
}

// ============================================================================
// AI Sifting Stage
// ============================================================================

interface SiftingResultItem {
  doi: string;
  title: string;
  keep: boolean;
}

interface SiftingResponse {
  siftedResults: SiftingResultItem[];
}

export async function runSiftingStage(
  box: SubBoxInput,
  candidates: ValidatedPaper[],
  logger: Logger,
  thesisCtx: {
    studyTitle: string;
    researchQuestion: string;
    theoreticalFramework: string;
    historicalSpatialLimits: string;
  },
): Promise<ValidatedPaper[]> {
  const CHUNK_SIZE = 60;
  const keptDecisions = new Map<string, boolean>();

  for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
    const chunk = candidates.slice(i, i + CHUNK_SIZE);
    const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
    const totalChunks = Math.ceil(candidates.length / CHUNK_SIZE);

    const siftingInput = chunk.map((c) => ({
      doi: c.doi ?? "",
      title: c.title,
      abstract: c.abstract ? c.abstract.slice(0, 300) + "..." : "",
      authors: c.authors,
    }));

    const siftingResult = await generateStructuredContent<SiftingResponse>(
      "gemini-3.1-flash-lite",
      LITERATURE_SIFTING_SYSTEM_INSTRUCTION,
      buildLiteratureSiftingPrompt(
        {
          title: box.title,
          description: box.description,
        },
        siftingInput,
        thesisCtx,
      ),
      literatureSiftingSchema,
      logger,
      { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } },
    );

    for (const r of siftingResult.siftedResults) {
      if (r.keep) {
        if (r.doi) keptDecisions.set("doi:" + r.doi, true);
        if (r.title)
          keptDecisions.set("title:" + r.title.toLowerCase().trim(), true);
      }
    }

    logger.info("literature_sifting_chunk", {
      service: "literature",
      data: {
        chunkIndex,
        totalChunks,
        chunkSize: chunk.length,
        keptInChunk: siftingResult.siftedResults.filter((r) => r.keep).length,
      },
    });
  }

  const kept = candidates.filter((c) => {
    if (c.doi && keptDecisions.has("doi:" + c.doi)) return true;
    if (c.title && keptDecisions.has("title:" + c.title.toLowerCase().trim()))
      return true;
    return false;
  });

  return kept;
}

// ============================================================================
// AI Jury Analysis Stage
// ============================================================================

interface JuryResponse {
  starterPack: JuryArticle[];
  reservedPool: JuryArticle[];
}

export async function runJuryStage(
  box: SubBoxInput,
  sifted: ValidatedPaper[],
  logger: Logger,
): Promise<LiteratureReviewResult> {
  const juryCandidates = sifted.map((c) => ({
    doi: c.doi ?? "",
    title: c.title,
    abstract: c.abstract ?? "",
    url: c.url ?? "",
    publisher: c.publisher ?? "",
    publicationYear: c.year ?? 0,
    authors: c.authors,
  }));

  const juryResult = await generateStructuredContent<JuryResponse>(
    "gemini-3.1-flash-lite",
    LITERATURE_JURY_ANALYSIS_SYSTEM_INSTRUCTION,
    buildLiteratureJuryAnalysisPrompt(
      {
        title: box.title,
        description: box.description,
      },
      juryCandidates,
    ),
    literatureJuryAnalysisSchema,
    logger,
    { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } },
  );

  return {
    starterPack: juryResult.starterPack,
    reservedPool: juryResult.reservedPool,
  };
}

// ============================================================================
// CrossRef & Enrichment Helper (polite-pool)
// ============================================================================

export async function enrichJuryArticleWithCrossRef(
  article: JuryArticle,
  pool: ValidatedPaper[],
): Promise<JuryArticle> {
  if (article.doi) {
    const match = pool.find((p) => p.doi === article.doi);
    if (match?.abstract) {
      article.abstract = match.abstract;
    }
  } else if (article.title) {
    const titleKey = article.title.toLowerCase().trim().slice(0, 80);
    const match = pool.find(
      (p) => p.title?.toLowerCase().trim().slice(0, 80) === titleKey,
    );
    if (match?.abstract) {
      article.abstract = match.abstract;
    }
  }

  if (!article.doi) return article;

  const paper: ValidatedPaper = {
    title: article.title,
    abstract: article.abstract,
    doi: article.doi,
    url: article.url,
    authors: [...article.authors],
    year: article.publicationYear,
    publisher: article.publisher,
  };

  const enriched = await validateWithCrossRef(paper);

  article.authors = enriched.authors;
  article.url = enriched.url ?? article.url;
  article.publisher = enriched.publisher ?? article.publisher;
  if (enriched.year) article.publicationYear = enriched.year;

  return article;
}
