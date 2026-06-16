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
import type {
  SubBoxInput,
  ValidatedPaper,
} from "@/lib/literature-review-papers";
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
  score: number;
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
  const scoreDecisions = new Map<string, number>();

  for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
    const chunk = candidates.slice(i, i + CHUNK_SIZE);
    const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
    const totalChunks = Math.ceil(candidates.length / CHUNK_SIZE);

    const siftingInput = chunk.map((c) => ({
      doi: c.doi ?? "",
      title: c.title,
      metadata: c.metadata ?? "",
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
        if (r.doi) {
          keptDecisions.set("doi:" + r.doi, true);
          scoreDecisions.set("doi:" + r.doi, r.score);
        }
        if (r.title) {
          const titleKey = "title:" + r.title.toLowerCase().trim();
          keptDecisions.set(titleKey, true);
          scoreDecisions.set(titleKey, r.score);
        }
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

  for (const c of kept) {
    const scoreKey = c.doi
      ? "doi:" + c.doi
      : c.title
        ? "title:" + c.title.toLowerCase().trim()
        : null;
    if (scoreKey) {
      const score = scoreDecisions.get(scoreKey);
      if (score !== undefined) {
        (c as unknown as Record<string, unknown>).siftingScore = score;
      }
    }
  }

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
    siftingScore:
      ((c as unknown as Record<string, unknown>).siftingScore as number) ?? 0,
  }));

  // Build lookup for isFoundational backfill
  const foundationalLookup = new Map<string, boolean>();
  for (const p of sifted) {
    if (p.doi) {
      foundationalLookup.set("doi:" + p.doi, p.isFoundational);
    }
    if (p.title) {
      foundationalLookup.set(
        "title:" + p.title.toLowerCase().trim().slice(0, 80),
        p.isFoundational,
      );
    }
  }

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

  function backfillIsFoundational(articles: JuryArticle[]): JuryArticle[] {
    return articles.map((a) => {
      let found = false;
      if (a.doi) {
        found = foundationalLookup.get("doi:" + a.doi) ?? false;
      }
      if (!found && a.title) {
        found =
          foundationalLookup.get(
            "title:" + a.title.toLowerCase().trim().slice(0, 80),
          ) ?? false;
      }
      return { ...a, isFoundational: found };
    });
  }

  return {
    starterPack: backfillIsFoundational(juryResult.starterPack),
    reservedPool: backfillIsFoundational(juryResult.reservedPool),
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
    metadata: null,
    doi: article.doi,
    url: article.url,
    authors: [...article.authors],
    year: article.publicationYear,
    publisher: article.publisher,
    openAlexId: null,
    isFoundational: article.isFoundational ?? false,
    relevanceScore: 0,
  };

  const enriched = await validateWithCrossRef(paper);

  article.authors = enriched.authors;
  article.url = enriched.url ?? article.url;
  article.publisher = enriched.publisher ?? article.publisher;
  if (enriched.year) article.publicationYear = enriched.year;

  return article;
}
