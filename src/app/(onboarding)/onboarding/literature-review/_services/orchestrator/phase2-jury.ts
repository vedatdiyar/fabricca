import { franc } from "franc-min";
import { Logger } from "@/lib/logger";
import {
  extractCleanDoi,
  parseDualSemanticQuery,
} from "@/lib/academic/utils";
import { areTitlesDuplicateByMetric } from "@/lib/academic/title-utils";
import { extractSurname } from "@/lib/academic/filename-utils";
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

/**
 * Determines whether a paper's language is a jury target (Turkish or English).
 * Uses lightweight deterministic `franc-min` trigram detection; undetermined (`und`)
 * is allowed through to avoid false positives on short titles.
 *
 * @param title - Paper title.
 * @param abstract - Optional abstract (first 300 chars combined with title are sampled).
 * @returns True when lang is tur/eng or undetermined; false for deu/fra/spa/ita etc.
 */
export function isTargetLanguage(
  title: string,
  abstract?: string | null,
): boolean {
  const sampleText = `${title} ${abstract ?? ""}`.slice(0, 300);
  let lang: string;
  try {
    lang = franc(sampleText, { minLength: 10 });
  } catch {
    return true;
  }
  if (lang === "und") return true;
  return lang === "tur" || lang === "eng";
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
 * Hybrid fallback scorer when Cohere Rerank is unavailable (429/5xx/timeout/10 RPM).
 * Prevents old highly-cited but off-topic papers from dominating.
 *
 * @param paper - Candidate RawPaper (relevanceScore, citedByCount, year).
 * @returns Deterministic score in [0..1] (weighted: 70% semantic, 20% citation, 10% recency).
 */
export function calculateFallbackScore(paper: import("../literature-review-papers").RawPaper): number {
  // semanticScore [0..1] — channel base relevance; fallback 0.5 when missing
  const rawSemantic = (paper as { relevanceScore?: number }).relevanceScore;
  const semanticScore =
    typeof rawSemantic === "number" && Number.isFinite(rawSemantic)
      ? Math.min(1, Math.max(0, rawSemantic))
      : 0.5;

  // citationScore [0..1] — log-normalized to suppress extremes (10k citations ≈ 1.0)
  const citationScore = Math.min(1, Math.log10((paper.citedByCount ?? 0) + 1) / 4);

  // recencyScore [0..1] — favors last 3y (1.0) → 10y+ (0.2) linear decay
  const currentYear = new Date().getFullYear();
  const year = paper.year ?? currentYear - 10;
  const age = currentYear - year;
  let recencyScore: number;
  if (age <= 3) recencyScore = 1.0;
  else if (age >= 10) recencyScore = 0.2;
  else recencyScore = 1.0 - ((age - 3) * (0.8 / 7));

  return semanticScore * 0.7 + citationScore * 0.2 + recencyScore * 0.1;
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
 * 4. Cohere Rerank v4.0 Pro semantic pre-ranking against sub-box context (top 18).
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

  const processedResults = await Promise.all(
    fulfilledResults.map(async (r) => {
      let pool = buildPool(r);
      if (pool.length === 0) {
        return {
          thesisBoxId: r.thesisBoxId,
          capped: [] as PoolItem[],
          juryInput: null,
        };
      }

      // 1. Cross-channel deduplication & code-level pre-filters
      // DOI exact match + metric-based title dedup (Jaccard/Levenshtein >=0.90) with year/author guard
      const seenDois = new Set<string>();
      const seenPapers: Array<{ title: string; year: number | null; authors: string[] }> = [];
      pool = pool.filter((item) => {
        const title = item.rawPaper.title ?? "";
        const abstract = item.rawPaper.abstract ?? "";
        if (!title || title.trim().length < 3) return false;

        // Code-level pre-filters (before dedup to avoid polluting seen set)
        if (isBookReview(title, abstract)) return false;
        if (!isTargetLanguage(title, abstract)) {
          const sampleText = `${title} ${abstract ?? ""}`.slice(0, 300);
          let detectedLang = "und";
          try {
            detectedLang = franc(sampleText, { minLength: 10 });
          } catch {
            detectedLang = "und";
          }
          logger.info("foreign_language_paper_dropped", {
            hidden: true,
            data: { title: title.slice(0, 120), detectedLang },
          });
          return false;
        }
        if (isPeriodMismatch(r.boxType, title)) return false;

        const doi = extractCleanDoi(item.rawPaper.doi ?? "");
        if (doi && seenDois.has(doi)) return false;

        // Metric-based duplicate check: similarity >=0.90 AND (year ±1 OR first-author match)
        const isDuplicate = seenPapers.some((prev) => {
          if (!areTitlesDuplicateByMetric(title, prev.title, 0.90)) return false;
          const yearMatch =
            typeof item.rawPaper.year === "number" &&
            typeof prev.year === "number" &&
            Math.abs(item.rawPaper.year - prev.year) <= 1;
          const firstAuthorA = item.rawPaper.authors?.[0]
            ? extractSurname(item.rawPaper.authors[0]).toLowerCase()
            : null;
          const firstAuthorB = prev.authors?.[0]
            ? extractSurname(prev.authors[0]).toLowerCase()
            : null;
          const hasAuthor =
            !!firstAuthorA &&
            !!firstAuthorB &&
            firstAuthorA !== "anonim" &&
            firstAuthorB !== "anonim";
          const authorMatch = hasAuthor ? firstAuthorA === firstAuthorB : false;
          const hasMeta =
            (typeof item.rawPaper.year === "number" && typeof prev.year === "number") || hasAuthor;
          if (hasMeta) return yearMatch || authorMatch;
          return true;
        });
        if (isDuplicate) return false;

        if (doi) seenDois.add(doi);
        seenPapers.push({
          title,
          year: item.rawPaper.year ?? null,
          authors: item.rawPaper.authors ?? [],
        });
        return true;
      });

      // 2. Parallel pre-ranking: Cohere Rerank v4.0 Pro (top 18)
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

      // Cohere Rerank: executed concurrently across sub-boxes (limiter token-bucket in cohere.ts)
      if (candidateDocs.length > 0) {
        const rerankResults = await rerankWithCohere({
          query: queryContext,
          documents: candidateDocs,
          topN: Math.min(18, candidateDocs.length),
          logger,
          silent: true,
        });

        if (rerankResults.length > 0) {
          capped = rerankResults
            .slice(0, 18)
            .map((res) => pool[res.index])
            .filter((item): item is PoolItem => Boolean(item));
        }
      }

      return {
        thesisBoxId: r.thesisBoxId,
        capped,
        juryInput: {
          box: {
            thesisBoxId: r.thesisBoxId,
            subBoxTitle: r.subBox.title,
            boxType: r.boxType,
            description: r.subBoxDescription,
            concepts: r.subBox.concepts,
          },
          articles: capped.map((p) => p.rawPaper),
        },
      };
    }),
  );

  for (const item of processedResults) {
    poolByBox.set(item.thesisBoxId, item.capped);
    if (item.juryInput && item.juryInput.articles.length > 0) {
      juryInputs.push(item.juryInput);
    }
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
