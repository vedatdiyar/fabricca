import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/gemini";
import {
  buildLiteratureAcademicReviewPrompt,
  buildLiteratureAcademicReviewSystemInstruction,
  literatureJuryAnalysisSchema,
} from "@/lib/prompts";
import { Logger } from "@/lib/logger";
import type { SubBoxInput, ValidatedPaper } from "./literature-review-papers";
import type { JuryArticle } from "@/lib/types";

// ============================================================================
// Literature Review Result Types
// ============================================================================

export interface LiteratureReviewResult {
  starterPack: JuryArticle[];
  reservedPool: JuryArticle[];
  error?: string;
  isArchivalBypass?: boolean;
}

// ============================================================================
// Single-Stage Academic Review (Eleme + Jüri Dağıtımı)
// ============================================================================

interface JuryResponseItem {
  id: string;
  type: "PRIMARY" | "SECONDARY";
  title: string;
  abstract: string;
  url: string;
  doi: string;
  publisher: string;
  publicationYear: number;
  authors: string[];
}

interface JuryResponse {
  starterPack: JuryResponseItem[];
  reservedPool: JuryResponseItem[];
}

export async function runAcademicReviewStage(
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
): Promise<LiteratureReviewResult> {
  logger.file("ai-processor.ts:runAcademicReviewStage");

  // Build a stable refId for each candidate so we can match Gemini's output
  // back to the original data. This is the hallucination firewall: any article
  // Gemini returns with an id NOT in this set is silently discarded.
  const reviewCandidates = candidates.map((c) => ({
    refId: c.openAlexId ?? c.doi ?? "title:" + c.title,
    doi: c.doi ?? "",
    title: c.title,
    abstract: c.abstract ?? "",
    url: c.url ?? "",
    publisher: c.publisher ?? "",
    publicationYear: c.year ?? 0,
    authors: c.authors,
    relevanceScore: Math.round(c.relevanceScore * 100),
  }));

  const validRefIds = new Set(reviewCandidates.map((c) => c.refId));

  // Build lookup for isFoundational backfill
  const foundationalLookup = new Map<string, boolean>();
  for (const p of candidates) {
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
    buildLiteratureAcademicReviewPrompt(
      {
        title: box.title,
        description: box.description,
      },
      reviewCandidates,
      thesisCtx,
    ),
  );

  const reviewResult = await generateStructuredContent<JuryResponse>(
    "gemini-3.1-flash-lite",
    buildLiteratureAcademicReviewSystemInstruction(),
    buildLiteratureAcademicReviewPrompt(
      {
        title: box.title,
        description: box.description,
      },
      reviewCandidates,
      thesisCtx,
    ),
    literatureJuryAnalysisSchema,
    logger,
    {
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      payloadStage: "academic-review",
    },
  );

  // ===== HALÜSİNASYON FİLTRESİ =====
  // Gemini'ın döndürdüğü her makalenin id'si mutlaka girdi listesindeki refId'lerden
  // biriyle eşleşmelidir. Eşleşmeyen uydurma kayıtlar sessizce atılır.
  function filterHallucinated(items: JuryResponseItem[]): JuryResponseItem[] {
    return items.filter((item) => item.id && validRefIds.has(item.id));
  }

  // id alanını sıyır → JuryArticle tipine dönüştür
  function toJuryArticle(item: JuryResponseItem): JuryArticle {
    return {
      type: item.type,
      title: item.title,
      abstract: item.abstract,
      url: item.url,
      doi: item.doi,
      publisher: item.publisher,
      publicationYear: item.publicationYear,
      authors: item.authors,
    };
  }

  const filteredStarterPack = filterHallucinated(reviewResult.starterPack).map(
    toJuryArticle,
  );
  const filteredReservedPool = filterHallucinated(
    reviewResult.reservedPool,
  ).map(toJuryArticle);

  const hallutotal =
    reviewResult.starterPack.length + reviewResult.reservedPool.length;
  const filteredTotal =
    filteredStarterPack.length + filteredReservedPool.length;
  const hallucinationCount = hallutotal - filteredTotal;

  if (hallucinationCount > 0) {
    logger.warn("literature_review_hallucination_filtered", {
      service: "literature",
      filePath: "ai-processor.ts",
      data: {
        hallucinationCount,
        boxTitle: box.title,
      },
    });
  }

  const result = {
    starterPack: backfillIsFoundational(
      filteredStarterPack,
      foundationalLookup,
    ),
    reservedPool: backfillIsFoundational(
      filteredReservedPool,
      foundationalLookup,
    ),
  };

  logger.data("Academic Review Split", {
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
