import { Logger } from "@/lib/logger";
import { normalizeCleanTitle, extractCleanDoi } from "@/lib/academic/utils";
import { evaluateSingleBoxJury, type JuryInputItem } from "../batch-jury";
import type { SubBoxResult, PoolItem, JuryEvalResult } from "./types";
import { buildPool } from "./phase1-search";

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
      .sort((a, b) => {
        if (a.rawPaper.isCoCitationLeader && !b.rawPaper.isCoCitationLeader)
          return -1;
        if (!a.rawPaper.isCoCitationLeader && b.rawPaper.isCoCitationLeader)
          return 1;
        const relDiff = b.rawPaper.relevanceScore - a.rawPaper.relevanceScore;
        if (Math.abs(relDiff) > 0.0001) return relDiff > 0 ? 1 : -1;
        return (b.rawPaper.citedByCount ?? 0) - (a.rawPaper.citedByCount ?? 0);
      })
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
