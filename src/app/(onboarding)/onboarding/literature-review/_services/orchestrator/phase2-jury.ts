import { Logger } from "@/lib/logger";
import { normalizeCleanTitle, extractCleanDoi } from "@/lib/academic/utils";
import { evaluateSingleBoxJury, type JuryInputItem } from "../batch-jury";
import type { SubBoxResult, PoolItem, JuryEvalResult } from "./types";

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
 * Executes Phase 2 jury evaluation over the de-duplicated candidate pools,
 * batching each sub-box pool into a single jury evaluation.
 *
 * @param fulfilledResults - The Phase 1 search results per sub-box.
 * @param logger - The shared flow logger.
 * @param thesisMatrixSubject - Optional thesis matrix subject used to guide the jury.
 * @returns The per-box candidate pools and the pooled jury evaluations.
 */
export async function executePhase2Jury(
  fulfilledResults: SubBoxResult[],
  logger: Logger,
  thesisMatrixSubject?: string,
): Promise<{
  poolByBox: Map<number, PoolItem[]>;
  juryEvaluations: JuryEvalResult[];
}> {
  logger.info("literature_batch_jury_start");

  const juryInputs: JuryInputItem[] = [];
  const poolByBox = new Map<number, PoolItem[]>();

  for (const r of fulfilledResults) {
    let pool = buildPool(r);
    if (pool.length === 0) continue;

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

    const capped = pool
      .sort(
        (a, b) =>
          b.rawPaper.relevanceScore - a.rawPaper.relevanceScore ||
          (b.rawPaper.citedByCount ?? 0) - (a.rawPaper.citedByCount ?? 0),
      )
      .slice(0, 12);

    poolByBox.set(r.thesisBoxId, capped);
    juryInputs.push({
      box: {
        thesisBoxId: r.thesisBoxId,
        subBoxTitle: r.subBox.title,
        boxType: r.boxType,
        description: r.subBoxDescription,
      },
      articles: capped.map((p) => p.rawPaper),
    });
  }

  let juryEvaluations: JuryEvalResult[] = [];

  if (juryInputs.length > 0) {
    const subjectProblem = thesisMatrixSubject ?? "";

    try {
      const juryResults = await Promise.all(
        juryInputs.map(async (input) => {
          const result = await evaluateSingleBoxJury(
            subjectProblem,
            input,
            logger,
          );
          return result.evaluations;
        }),
      );
      juryEvaluations = juryResults.flat();

      logger.info("literature_batch_jury_success", {
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
