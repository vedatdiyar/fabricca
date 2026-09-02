import { Logger } from "@/lib/logger";
import {
  normalizeCleanTitle,
  extractCleanDoi,
  parseDualSemanticQuery,
} from "@/lib/academic/utils";
import { rerankWithCohere } from "@/core/services/ai/cohere";
import {
  evaluateMultiBoxJury,
  type JuryInputItem,
  type ThesisMatrixContext,
} from "../batch-jury";
import type { SubBoxResult, PoolItem, JuryEvalResult } from "./types";

export type { ThesisMatrixContext } from "../batch-jury";

// Book Review detection regex
const BOOK_REVIEW_TITLE_PATTERNS = [
  /\bbook\s+review\b/i,
  /\breview\s+article\b/i,
  /^review:\s+/i,
  /\bcolloque\b/i,
  /\bby\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s*$/i,
];

const BOOK_REVIEW_ABSTRACT_PATTERNS = [
  /\b(REVIEWED BY|Reviewed by)\b/i,
  /\bPp\.\s*\d+\b/i,
  /\$\s*\d+(\.\d+)?\s*(cloth|paper|hardcover|pb)\b/i,
  /\bISBN\s*[\d-]+\b/i,
];

function isBookReview(
  title: string | null | undefined,
  abstract: string | null | undefined,
): boolean {
  if (title && BOOK_REVIEW_TITLE_PATTERNS.some((p) => p.test(title)))
    return true;
  if (
    abstract &&
    BOOK_REVIEW_ABSTRACT_PATTERNS.some((p) => p.test(abstract.slice(0, 300)))
  )
    return true;
  return false;
}

const FOREIGN_ROMANCE_GERMANIC_RE =
  /\b(della|dello|degli|delle|nella|nello|negli|nelle|congiuntura|quaderni|rivoluzione|carcere|pour|dans|avec|sur|une|des|sobre|hacia|und|der|die|das|aufspüren|korpuspragmatisch)\b/i;

function isForeignTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  return FOREIGN_ROMANCE_GERMANIC_RE.test(title);
}

const PERIOD_MISMATCH_RE =
  /\b(2011[-–]2017|2005[-–]2015|2001[-–]2017|2007[-–]8|post[-–]2000|since\s+2000|AKP['’]?s|AK\s+Parti['’]?nin|AK\s+Parti['’]?s)\b/i;

function isPeriodMismatch(
  boxType: string,
  title: string | null | undefined,
): boolean {
  if (boxType !== "SUBJECT_PROBLEM") return false;
  return PERIOD_MISMATCH_RE.test(title ?? "");
}

/**
 * Builds the jury pool for a sub-box from raw papers only.
 *
 * @param r - The sub-box phase 1 result.
 * @returns The pooled items available for jury evaluation.
 */
function buildPool(r: SubBoxResult): PoolItem[] {
  return r.rawPapers.map((p) => ({
    type: "raw" as const,
    rawPaper: p,
  }));
}

/**
 * Executes Phase 2 jury evaluation over the de-duplicated candidate pools.
 * Applies:
 * 1. Title and DOI deduplication across all 4 channels.
 * 2. Abstract depth and monograph verification (seed worthiness).
 * 3. Pre-filters for book reviews, foreign language titles, and period mismatches.
 * 4. Cohere Rerank v4.0 Pro semantic pre-ranking against sub-box context (top 35).
 * 5. Structured Gemini Flash Lite academic jury evaluation with Holistic Thesis Matrix & Box Isolation.
 *
 * @param fulfilledResults - The Phase 1 search results per sub-box.
 * @param logger - The shared flow logger.
 * @param thesisMatrixContext - Optional thesis matrix context (string or 4-quadrant object) used to guide the jury.
 * @returns The per-box candidate pools and the pooled jury evaluations.
 */
export async function executePhase2Jury(
  fulfilledResults: SubBoxResult[],
  logger: Logger,
  thesisMatrixContext?: string | ThesisMatrixContext,
): Promise<{
  poolByBox: Map<number, PoolItem[]>;
  juryEvaluations: JuryEvalResult[];
}> {
  logger.info("literature_batch_jury_start", { hidden: true });

  const juryInputs: JuryInputItem[] = [];
  const poolByBox = new Map<number, PoolItem[]>();

  for (const r of fulfilledResults) {
    let pool = buildPool(r);
    if (pool.length === 0) continue;

    // 1. Cross-channel title and DOI deduplication & code-level pre-filters
    const seenNormTitles = new Set<string>();
    const seenDois = new Set<string>();
    pool = pool.filter((item) => {
      const title = item.rawPaper.title ?? "";
      const abstract = item.rawPaper.abstract ?? "";
      if (!title || title.trim().length < 3) return false;

      const normTitle = normalizeCleanTitle(title);
      const doi = extractCleanDoi(item.rawPaper.doi ?? "");
      if (doi) {
        if (seenDois.has(doi)) return false;
        seenDois.add(doi);
      }
      if (normTitle) {
        if (seenNormTitles.has(normTitle)) return false;
        seenNormTitles.add(normTitle);
      }

      // Code-level pre-filters
      if (isBookReview(title, abstract)) return false;
      if (isForeignTitle(title)) return false;
      if (isPeriodMismatch(r.boxType, title)) return false;

      return true;
    });

    // 2. Two-tiered pre-ranking: Cohere Rerank v4.0 Pro (top 35) with heuristic fallback
    let capped: PoolItem[] = [];
    const { openAlexQuery } = parseDualSemanticQuery(r.subBox.semanticQuery);
    const queryParts = [
      r.subBox.title,
      r.subBoxDescription,
      openAlexQuery ? `Scholarly context: ${openAlexQuery.slice(0, 400)}` : "",
    ].filter(Boolean);
    const queryContext = queryParts.join(". ").trim();

    const candidateDocs = pool.map((item) => {
      const parts = [
        item.rawPaper.title,
        item.rawPaper.authors?.length > 0
          ? `Yazarlar: ${item.rawPaper.authors.join(", ")}`
          : "",
        item.rawPaper.year ? `Yıl: ${item.rawPaper.year}` : "",
        item.rawPaper.publisher
          ? `Yayıncı/Kurum: ${item.rawPaper.publisher}`
          : "",
        item.rawPaper.citedByCount
          ? `Atıf Sayısı: ${item.rawPaper.citedByCount}`
          : "",
        item.rawPaper.abstract ?? item.rawPaper.metadata ?? "",
      ].filter(Boolean);
      return parts.join(". ").trim();
    });

    if (candidateDocs.length > 0) {
      try {
        const rerankResults = await rerankWithCohere({
          query: queryContext,
          documents: candidateDocs,
          topN: Math.min(35, candidateDocs.length),
          logger,
          silent: true,
        });

        if (rerankResults.length > 0) {
          capped = rerankResults
            .slice(0, 35)
            .map((res) => pool[res.index])
            .filter((item): item is PoolItem => Boolean(item));
        }
      } catch (rerankErr) {
        logger.warn("literature_cohere_rerank_fallback", {
          error:
            rerankErr instanceof Error ? rerankErr.message : String(rerankErr),
          data: { subBoxTitle: r.subBox.title },
        });
      }
    }

    // Heuristic fallback if Cohere wasn't used or returned empty
    if (capped.length === 0) {
      capped = pool
        .sort(
          (a, b) =>
            (b.rawPaper.citedByCount ?? 0) - (a.rawPaper.citedByCount ?? 0) ||
            b.rawPaper.relevanceScore - a.rawPaper.relevanceScore,
        )
        .slice(0, 35);
    }

    poolByBox.set(r.thesisBoxId, capped);
    juryInputs.push({
      box: {
        thesisBoxId: r.thesisBoxId,
        subBoxTitle: r.subBox.title,
        boxType: r.boxType,
        description: r.subBoxDescription,
        concepts: r.subBox.concepts,
      },
      articles: capped.map((p) => p.rawPaper),
    });
  }

  let juryEvaluations: JuryEvalResult[] = [];

  if (juryInputs.length > 0) {
    try {
      const juryResults = await evaluateMultiBoxJury(
        thesisMatrixContext,
        juryInputs,
        logger,
      );
      juryEvaluations = juryResults.flatMap((res) => res.evaluations);

      logger.info("literature_batch_jury_success", {
        hidden: true,
        data: { evaluationCount: juryEvaluations.length },
      });
    } catch (err) {
      logger.error("literature_batch_jury_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  return { poolByBox, juryEvaluations };
}
