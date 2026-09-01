import type { Logger } from "@/lib/logger";
import type { JuryArticle, LiteraturePoolEntry } from "@/lib/types";
import type { SubBoxInput, SubBoxItem } from "./literature-review-papers";
import type { BatchOrchestrationResult } from "./orchestrator/types";
import { executePhase1Search } from "./orchestrator/phase1-search";
import { executePhase2Jury } from "./orchestrator/phase2-jury";
import { executePhase3Selection } from "./orchestrator/phase3-selection";

import type { ThesisMatrixContext } from "./orchestrator/phase2-jury";

export type {
  BatchOrchestrationResult,
  SubBoxResult,
  PoolItem,
  JuryEvalResult,
} from "./orchestrator/types";

import type { PipelineRun } from "@/lib/pipeline-logger";

/**
 * Runs the full multi-box literature review pipeline across search, jury, selection and persistence phases.
 *
 * @param boxes - The sub-box inputs to process.
 * @param logger - The pipeline logger instance.
 * @param thesisMatrixContext - Optional thesis subject string or 4-quadrant matrix for jury context.
 * @param checkCancelled - Optional callback to abort the pipeline.
 * @param persistSubBox - Optional callback to persist articles per sub-box.
 * @param pipelineRun - Optional parent PipelineRun instance for step emission.
 * @returns The orchestrated pool entries and archival box titles.
 */
export async function orchestrateBatchProcess(
  boxes: SubBoxInput[],
  logger: Logger,
  thesisMatrixContext?: string | ThesisMatrixContext,
  checkCancelled?: () => boolean,
  persistSubBox?: (
    thesisBoxId: number,
    articles: JuryArticle[],
  ) => Promise<void>,
  pipelineRun?: PipelineRun,
): Promise<BatchOrchestrationResult> {
  const poolEntries: LiteraturePoolEntry[] = [];
  const archivalBoxTitles: string[] = [];

  for (let i = 0; i < boxes.length; i++) {
    if (checkCancelled?.()) break;
    const box = boxes[i];

    if (box.boxType === "PRIMARY_MATERIAL") {
      archivalBoxTitles.push(box.title);
      poolEntries.push({
        subBoxTitle: box.title,
        thesisBoxId: box.id,
        articles: [],
      });
    }
  }

  const activeJobs: { box: SubBoxInput; subBox: SubBoxItem }[] = [];
  for (const box of boxes) {
    if (!box.subBoxes || box.subBoxes.length === 0) continue;
    if (box.boxType === "PRIMARY_MATERIAL" || box.boxType === "RELATED_THESES")
      continue;

    for (const subBox of box.subBoxes) {
      activeJobs.push({ box, subBox });
    }
  }

  if (activeJobs.length === 0) {
    return { poolEntries, archivalBoxTitles };
  }

  // Phase 1: Search & Pool Building
  const t1 = performance.now();
  const fulfilledResults = await executePhase1Search(
    activeJobs,
    logger,
    checkCancelled,
  );
  pipelineRun?.subStep(
    `4-Channel Academic Search (${activeJobs.length} sub-boxes)`,
    performance.now() - t1,
  );

  // Phase 2: Jury Pool Preparation & Evaluation
  const t2 = performance.now();
  const { poolByBox, juryEvaluations } = await executePhase2Jury(
    fulfilledResults,
    logger,
    thesisMatrixContext,
  );
  pipelineRun?.subStep(
    `Parallel Jury Evaluation (${juryEvaluations.length} candidate evaluations)`,
    performance.now() - t2,
  );

  // Phase 3: Article Selection, Sanitization & Author Healing
  const t3 = performance.now();
  const subBoxResultsToPersist = await executePhase3Selection(
    fulfilledResults,
    poolByBox,
    juryEvaluations,
    logger,
    checkCancelled,
  );
  pipelineRun?.subStep(
    "Article Selection & Sanitization",
    performance.now() - t3,
  );

  // Final Persistence Phase
  logger.info("literature_db_write_start", { hidden: true });

  for (const item of subBoxResultsToPersist) {
    if (checkCancelled?.()) break;

    poolEntries.push({
      subBoxTitle: item.subBoxTitle,
      thesisBoxId: item.thesisBoxId,
      articles: item.articles,
    });

    if (persistSubBox && item.articles.length > 0) {
      try {
        await persistSubBox(item.thesisBoxId, item.articles);
      } catch (err) {
        logger.error("literature_progressive_save_failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }
  }

  logger.info("literature_db_write_success", { hidden: true });

  return { poolEntries, archivalBoxTitles };
}
