"use server";

import { sql } from "drizzle-orm";
import { db } from "@/core/db";
import { matrices } from "@/core/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { PipelineRun } from "@/lib/pipeline-logger";
import { PROPOSAL_POSITIONING_PIPELINE } from "@/lib/pipeline-definitions";
import { clearDownstreamDbAction } from "../../actions";
import { synthesizeInitialMatrixFromProposal } from "../../matrix/_services/proposal-synthesis-service";
import { searchAndSiftTheses } from "../_services/sifting";
import { evaluateThesesInParallel } from "../_services/per-thesis-evaluation";
import { analyzePositioningJury } from "../_services/analysis";
import { savePositioningReportTransaction } from "../_services/decision-engine";
import { invalidateOnboardingStepCache } from "@/lib/cache-tags";
import { sanitizeJuryTheses } from "./positioning-helpers";

/**
 * Unified entry action: raw proposal -> headless matrix -> 4-channel search -> jury -> persist.
 *
 * @param rawProposal - The user's raw proposal text.
 * @param flowId - Optional shared flow identifier.
 * @returns Success flag or error message.
 */
export async function startOnboardingFromProposalAction(
  rawProposal: string,
  flowId?: string,
): Promise<{ success: true } | { error: string }> {
  const run = flowId
    ? PipelineRun.resume(PROPOSAL_POSITIONING_PIPELINE, flowId)
    : PipelineRun.create(PROPOSAL_POSITIONING_PIPELINE);

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const trimmed = rawProposal.trim();
    if (trimmed.length < 50) {
      return {
        error:
          "Lütfen analiz için en az 50 karakter uzunluğunda bir tez taslağı girin.",
      };
    }

    await clearDownstreamDbAction("proposal");

    // Stage 1: Matrix Decomposition & Persistence
    let matrixDbId = 0;
    const savedMatrix = await run.execute(
      "matrix",
      async () => {
        const t0 = performance.now();
        const matrix = await synthesizeInitialMatrixFromProposal(
          trimmed,
          run.logger,
        );
        run.subStep(
          "Proposal Decomposition (Gemini Flash)",
          performance.now() - t0,
        );

        const t1 = performance.now();
        const [persisted] = await db
          .insert(matrices)
          .values({
            userId: session.userId,
            rawProposal: trimmed,
            subjectProblem: matrix.subjectProblem,
            theoreticalFramework: matrix.theoreticalFramework,
            primaryMaterial: matrix.primaryMaterial,
            methodology: matrix.methodology,
            updatedAt: sql`now()`,
          })
          .onConflictDoUpdate({
            target: matrices.userId,
            set: {
              rawProposal: trimmed,
              subjectProblem: matrix.subjectProblem,
              theoreticalFramework: matrix.theoreticalFramework,
              primaryMaterial: matrix.primaryMaterial,
              methodology: matrix.methodology,
              updatedAt: sql`now()`,
            },
          })
          .returning({ id: matrices.id });

        if (!persisted) {
          throw new Error("Tez matrisi oluşturulamadı.");
        }
        matrixDbId = persisted.id;

        run.subStep("Matrix Saved to Database", performance.now() - t1);

        return matrix;
      },
      { description: "Initial Matrix Synthesis (Gemini Flash)" },
    );

    // Stage 2: 4-Channel Literature Search & Cohere Rerank
    const siftedCandidates = await run.execute(
      "search",
      () =>
        searchAndSiftTheses(
          {
            subjectProblem: savedMatrix.subjectProblem,
            theoreticalFramework: savedMatrix.theoreticalFramework,
            methodology: savedMatrix.methodology,
          },
          run.logger,
          {
            pipelineRun: run,
          },
        ),
      { description: "4-Channel Literature Scan & Cohere Rerank" },
    );

    // Stage 3: Candidate Evaluation & Positioning Jury
    const juryResult = await run.execute(
      "jury_review",
      async () => {
        const t0 = performance.now();
        const evaluated = await evaluateThesesInParallel(
          {
            subjectProblem: savedMatrix.subjectProblem,
            theoreticalFramework: savedMatrix.theoreticalFramework,
            methodology: savedMatrix.methodology,
          },
          siftedCandidates,
          run.logger,
        );
        run.subStep(
          `Parallel Candidate Evaluation (${siftedCandidates.length} theses)`,
          performance.now() - t0,
        );

        const relevant = evaluated.filter((e) => e.evaluation.isRelevant);

        const t1 = performance.now();
        const jury = await analyzePositioningJury(
          {
            subjectProblem: savedMatrix.subjectProblem,
            theoreticalFramework: savedMatrix.theoreticalFramework,
            methodology: savedMatrix.methodology,
          },
          relevant,
          run.logger,
        );
        run.subStep(
          `Positioning Jury Synthesis (${relevant.length} relevant)`,
          performance.now() - t1,
        );

        return jury;
      },
      { description: "Gemini Candidate Evaluation & Jury Review" },
    );

    // Stage 4: Persist Positioning Report
    await run.execute(
      "persist",
      async () => {
        const t0 = performance.now();
        await sanitizeJuryTheses(juryResult, run.logger);
        if ((juryResult.recommendedTheses?.length ?? 0) > 0) {
          run.subStep(
            `Data Sanitization (${juryResult.recommendedTheses!.length} titles)`,
            performance.now() - t0,
          );
        }

        await savePositioningReportTransaction(
          session.userId,
          matrixDbId,
          juryResult,
        );
      },
      { description: "Positioning Report Saved to Database" },
    );

    run.finish();

    invalidateOnboardingStepCache("proposal");
    invalidateOnboardingStepCache("positioning");

    return { success: true };
  } catch (err) {
    run.finish();
    const msg =
      err instanceof Error
        ? err.message
        : "Tez taslağı incelenirken beklenmeyen bir hata oluştu.";
    return { error: msg };
  }
}
