import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/gemini";
import {
  buildLiteratureSiftingPrompt,
  buildLiteratureJuryAnalysisPrompt,
  buildLiteratureSiftingSystemInstruction,
  buildLiteratureJuryAnalysisSystemInstruction,
  literatureSiftingSchema,
  literatureJuryAnalysisSchema,
} from "@/lib/prompts";
import { Logger } from "@/lib/logger";
import type { SubBoxInput, ValidatedPaper } from "./literature-review-papers";
import type { JuryArticle } from "@/lib/types";
import { validateWithCrossRef } from "./search-api";

// ============================================================================
// Literature Review Result Types
// ============================================================================

export interface LiteratureReviewResult {
  starterPack: JuryArticle[];
  reservedPool: JuryArticle[];
  error?: string;
}

// ============================================================================
// AI Sifting Stage
// ============================================================================

interface SiftingResultItem {
  id: string;
  status: "ACCEPT" | "REJECT";
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
    historicalLimits: string;
    spatialLimits: string;
  },
): Promise<ValidatedPaper[]> {
  logger.file("ai-processor.ts:43");
  const CHUNK_SIZE = 60;
  const keptDecisions = new Map<string, boolean>();

  for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
    const chunk = candidates.slice(i, i + CHUNK_SIZE);
    const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
    const totalChunks = Math.ceil(candidates.length / CHUNK_SIZE);

    const siftingInput = chunk.map((c) => ({
      id: c.openAlexId ?? c.doi ?? "title:" + c.title,
      title: c.title,
      abstract_clean: c.abstract ?? "",
      relevance_score: c.relevanceScore,
    }));

    const siftPrompt = buildLiteratureSiftingPrompt(
      {
        title: box.title,
        description: box.description,
      },
      siftingInput,
      thesisCtx,
    );
    if (chunkIndex === 1) {
      logger.prompt("gemini-3.1-flash-lite (LOW thinking)", siftPrompt);
    }

    const siftingResult = await generateStructuredContent<SiftingResponse>(
      "gemini-3.1-flash-lite",
      buildLiteratureSiftingSystemInstruction(),
      siftPrompt,
      literatureSiftingSchema,
      logger,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        payloadStage: "sifting",
      },
    );

    for (const r of siftingResult.siftedResults) {
      if (r.status === "ACCEPT") {
        keptDecisions.set("id:" + r.id, true);
      }
    }

    logger.info("literature_sifting_chunk", {
      service: "literature",
      data: {
        chunkIndex,
        totalChunks,
        chunkSize: chunk.length,
        keptInChunk: siftingResult.siftedResults.filter(
          (r) => r.status === "ACCEPT",
        ).length,
      },
    });
  }

  const kept = candidates.filter((c) => {
    const id = c.openAlexId ?? c.doi ?? "title:" + c.title;
    return id ? keptDecisions.has("id:" + id) : false;
  });

  for (const c of kept) {
    (c as unknown as Record<string, unknown>).siftingScore = Math.round(
      c.relevanceScore * 100,
    );
  }

  logger.data("Sifting Kept/Total", {
    kept: kept.length,
    total: candidates.length,
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
  logger.file("ai-processor.ts:144");

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

  logger.prompt(
    "gemini-3.1-flash-lite (HIGH thinking)",
    buildLiteratureJuryAnalysisPrompt(
      {
        title: box.title,
        description: box.description,
      },
      juryCandidates,
    ),
  );

  const juryResult = await generateStructuredContent<JuryResponse>(
    "gemini-3.1-flash-lite",
    buildLiteratureJuryAnalysisSystemInstruction(),
    buildLiteratureJuryAnalysisPrompt(
      {
        title: box.title,
        description: box.description,
      },
      juryCandidates,
    ),
    literatureJuryAnalysisSchema,
    logger,
    {
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      payloadStage: "jury",
    },
  );

  const result = {
    starterPack: backfillIsFoundational(
      juryResult.starterPack,
      foundationalLookup,
    ),
    reservedPool: backfillIsFoundational(
      juryResult.reservedPool,
      foundationalLookup,
    ),
  };

  logger.data("Jury Split", {
    starterPack: result.starterPack.length,
    reservedPool: result.reservedPool.length,
  });

  return result;
}

// ============================================================================
// Backfill isFoundational for Jury Articles
// ============================================================================

function backfillIsFoundational(
  articles: JuryArticle[],
  lookup: Map<string, boolean>,
): JuryArticle[] {
  return articles.map((a) => {
    let found = false;
    if (a.doi) {
      found = lookup.get("doi:" + a.doi) ?? false;
    }
    if (!found && a.title) {
      found =
        lookup.get("title:" + a.title.toLowerCase().trim().slice(0, 80)) ??
        false;
    }
    return { ...a, isFoundational: found };
  });
}

// ============================================================================
// CrossRef & Enrichment Helper (polite-pool)
// ============================================================================

export async function enrichJuryArticleWithCrossRef(
  article: JuryArticle,
  pool: ValidatedPaper[],
): Promise<JuryArticle> {
  let resolvedAbstract = article.abstract;

  if (article.doi) {
    const match = pool.find((p) => p.doi === article.doi);
    if (match?.abstract) {
      resolvedAbstract = match.abstract;
    }
  } else if (article.title) {
    const titleKey = article.title.toLowerCase().trim().slice(0, 80);
    const match = pool.find(
      (p) => p.title?.toLowerCase().trim().slice(0, 80) === titleKey,
    );
    if (match?.abstract) {
      resolvedAbstract = match.abstract;
    }
  }

  if (!article.doi) {
    return { ...article, abstract: resolvedAbstract };
  }

  const paper: ValidatedPaper = {
    title: article.title,
    abstract: resolvedAbstract,
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

  return {
    ...article,
    abstract: resolvedAbstract,
    authors: enriched.authors.length > 0 ? enriched.authors : article.authors,
    url: enriched.url ?? article.url,
    publisher: enriched.publisher ?? article.publisher,
    publicationYear: enriched.year ?? article.publicationYear,
  };
}
