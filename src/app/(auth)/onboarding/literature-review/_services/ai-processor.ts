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
    researchScope: string;
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

// ============================================================================
// Global Cross-Box Candidate Deduplication (Pre-AI Stage)
// ============================================================================

/** Minimum safe candidate count per box after global dedup. */
const GLOBAL_DEDUP_MIN_SAFE_COUNT = 5;

interface DedupEliminatedEntry {
  boxTitle: string;
  candidate: ValidatedPaper;
  relevanceScore: number;
}

/**
 * Deduplicates raw candidates across all boxes globally.
 *
 * If the same article (matching DOI or OpenAlex ID) appears in multiple boxes,
 * it is retained only in the box where it achieved the highest relevanceScore.
 * After hard dedup, if any box falls below the safe threshold
 * (`GLOBAL_DEDUP_MIN_SAFE_COUNT`), the highest-scoring eliminated candidates
 * are restored to that box as a soft-dedup safeguard.
 *
 * @param boxCandidates - Map of box title → array of raw candidates
 * @returns A new map with the same keys but deduplicated candidate arrays
 */
export function deduplicateCandidatesGlobally(
  boxCandidates: Map<string, ValidatedPaper[]>,
  logger?: Logger,
): Map<string, ValidatedPaper[]> {
  const result = new Map<string, ValidatedPaper[]>();

  // Clone the input so we never mutate the caller's data
  for (const [title, candidates] of boxCandidates) {
    result.set(
      title,
      candidates.map((c) => ({ ...c })),
    );
  }

  // ------------------------------------------------------------------
  // Phase 1: Build a global index keyed by dedup key
  // ------------------------------------------------------------------
  // dedupKey → { boxTitle, relevanceScore, indexInBox }[]
  const globalIndex = new Map<
    string,
    { boxTitle: string; relevanceScore: number; index: number }[]
  >();

  for (const [boxTitle, candidates] of result) {
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const dedupKey = resolveDedupKey(c);
      if (!dedupKey) continue;

      let bucket = globalIndex.get(dedupKey);
      if (!bucket) {
        bucket = [];
        globalIndex.set(dedupKey, bucket);
      }
      bucket.push({
        boxTitle,
        relevanceScore: c.relevanceScore,
        index: i,
      });
    }
  }

  // ------------------------------------------------------------------
  // Phase 2: Hard dedup — keep only the highest-scoring occurrence
  // ------------------------------------------------------------------
  // Track eliminated candidates per box for soft-restore
  const eliminatedPerBox = new Map<string, DedupEliminatedEntry[]>();

  for (const [, occurrences] of globalIndex) {
    if (occurrences.length < 2) continue; // not a duplicate

    // Sort by relevanceScore descending, then by box title alphabetically
    // for deterministic tie-breaking
    occurrences.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore)
        return b.relevanceScore - a.relevanceScore;
      return a.boxTitle.localeCompare(b.boxTitle);
    });

    // Keep the winner (occurrences[0]), eliminate duplicates starting at index 1

    for (let k = 1; k < occurrences.length; k++) {
      const loser = occurrences[k];
      const boxCandidates = result.get(loser.boxTitle);
      if (!boxCandidates) continue;

      const candidate = boxCandidates[loser.index];
      if (!candidate) continue;

      // Mark as eliminated (null) — we'll compact later
      boxCandidates[loser.index] = null as unknown as ValidatedPaper;

      let elimBucket = eliminatedPerBox.get(loser.boxTitle);
      if (!elimBucket) {
        elimBucket = [];
        eliminatedPerBox.set(loser.boxTitle, elimBucket);
      }
      elimBucket.push({
        boxTitle: loser.boxTitle,
        candidate,
        relevanceScore: candidate.relevanceScore,
      });
    }
  }

  // ------------------------------------------------------------------
  // Phase 3: Compact nulls from each box
  // ------------------------------------------------------------------
  for (const [boxTitle, candidates] of result) {
    const compacted = candidates.filter((c): c is ValidatedPaper => c !== null);
    result.set(boxTitle, compacted);
  }

  // ------------------------------------------------------------------
  // Phase 4: Soft restore — if any box is starving, bring back
  //           the highest-scoring eliminated candidates
  // ------------------------------------------------------------------
  for (const [boxTitle, candidates] of result) {
    if (candidates.length >= GLOBAL_DEDUP_MIN_SAFE_COUNT) continue;

    const eliminated = eliminatedPerBox.get(boxTitle);
    if (!eliminated || eliminated.length === 0) continue;

    // Sort eliminated by relevanceScore descending
    eliminated.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const needed = GLOBAL_DEDUP_MIN_SAFE_COUNT - candidates.length;
    const toRestore = eliminated.slice(0, needed);

    for (const entry of toRestore) {
      candidates.push({ ...entry.candidate });
    }

    // Also restore them to the logger (but not to any other box)
    if (logger && toRestore.length > 0) {
      logger.warn("literature_soft_dedup_restore", {
        service: "literature",
        filePath: "ai-processor.ts",
        data: {
          boxTitle,
          restoredCount: toRestore.length,
          candidateTitles: toRestore.map((e) => e.candidate.title),
          context: `Soft-dedup restore: ${toRestore.length} aday ${boxTitle} kutusuna geri iade edildi`,
        },
      });
    }
  }

  return result;
}

/**
 * Resolves a stable deduplication key for a candidate.
 * Priority: DOI > OpenAlex ID > title (first 100 chars lowercase).
 * Returns null if no meaningful key can be derived.
 */
function resolveDedupKey(candidate: ValidatedPaper): string | null {
  if (candidate.doi) {
    const cleaned = candidate.doi.trim().toLowerCase();
    if (/^10\.\d{4,}/.test(cleaned)) return "doi:" + cleaned;
  }
  if (candidate.openAlexId) {
    return "oa:" + candidate.openAlexId.trim();
  }
  if (candidate.title) {
    const titleKey = candidate.title
      .toLowerCase()
      .replace(/\s+/g, " ")
      .slice(0, 100)
      .trim();
    if (titleKey.length > 10) return "title:" + titleKey;
  }
  return null;
}
