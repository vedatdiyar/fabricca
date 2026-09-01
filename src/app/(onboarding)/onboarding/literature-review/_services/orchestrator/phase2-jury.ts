import { Logger } from "@/lib/logger";
import { normalizeCleanTitle, extractCleanDoi } from "@/lib/academic/utils";
import { rerankWithCohere } from "@/core/services/ai/cohere";
import {
  evaluateSingleBoxJury,
  type JuryInputItem,
  type ThesisMatrixContext,
} from "../batch-jury";
import type { SubBoxResult, PoolItem, JuryEvalResult } from "./types";

export type { ThesisMatrixContext } from "../batch-jury";

/** Minimum abstract character length for a viable seed candidate. */
const MIN_ABSTRACT_CHARS = 45;

/**
 * Validates whether a paper's abstract possesses enough substance to be evaluated by the jury.
 *
 * @param abstract - Candidate abstract text.
 * @returns True if the abstract is meaningful, false if missing or placeholder.
 */
function hasSubstantialAbstract(abstract?: string | null): boolean {
  if (!abstract) return false;
  const trimmed = abstract.trim();
  if (trimmed.length < MIN_ABSTRACT_CHARS) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower === "no abstract available" ||
    lower === "özet bulunamadı" ||
    lower.startsWith("no abstract")
  ) {
    return false;
  }
  return true;
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
 * 2. Abstract depth verification (seed worthiness).
 * 3. Cohere Rerank v4.0 Pro semantic pre-ranking against sub-box context (with heuristic fallback).
 * 4. Structured Gemini Flash Lite academic jury evaluation with Holistic Thesis Matrix & Box Isolation.
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

    // 1. Cross-channel title and DOI deduplication
    const seenNormTitles = new Set<string>();
    const seenDois = new Set<string>();
    pool = pool.filter((item) => {
      const normTitle = normalizeCleanTitle(item.rawPaper.title ?? "");
      const doi = extractCleanDoi(item.rawPaper.doi ?? "");
      if (doi) {
        if (seenDois.has(doi)) return false;
        seenDois.add(doi);
      }
      if (normTitle) {
        if (seenNormTitles.has(normTitle)) return false;
        seenNormTitles.add(normTitle);
      }
      return true;
    });

    // 2. Abstract depth filter (seed-worthiness)
    const withSubstantialAbstract = pool.filter((item) =>
      hasSubstantialAbstract(item.rawPaper.abstract),
    );
    // Prefer candidates with substantial abstracts; fallback if pool is too small
    if (withSubstantialAbstract.length >= 4) {
      pool = withSubstantialAbstract;
    }

    // 3. Two-tiered pre-ranking: Cohere Rerank v4.0 Pro with heuristic fallback
    let capped: PoolItem[] = [];
    const queryContext = `${r.subBox.title}. ${r.subBoxDescription}`.trim();
    const candidateDocs = pool.map((item) =>
      `${item.rawPaper.title ?? ""}. ${item.rawPaper.abstract ?? ""}`.trim(),
    );

    if (candidateDocs.length > 0) {
      try {
        const rerankResults = await rerankWithCohere({
          query: queryContext,
          documents: candidateDocs,
          topN: 20,
          logger,
          silent: true,
        });

        if (rerankResults.length > 0) {
          capped = rerankResults
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
            b.rawPaper.relevanceScore - a.rawPaper.relevanceScore ||
            (b.rawPaper.citedByCount ?? 0) - (a.rawPaper.citedByCount ?? 0),
        )
        .slice(0, 20);
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
      const juryResults = await Promise.all(
        juryInputs.map(async (input) => {
          const result = await evaluateSingleBoxJury(
            thesisMatrixContext,
            input,
            logger,
          );
          return result.evaluations;
        }),
      );
      juryEvaluations = juryResults.flat();

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
