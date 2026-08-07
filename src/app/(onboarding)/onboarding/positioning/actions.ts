"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { positioning, matrices } from "@/db/schema";
import type { Positioning } from "@/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import type { ThesisMatrix } from "@/lib/types";
import { positioningMatrixSchema } from "./_lib/validation";
import type { SiftedThesis } from "./_services/sifting";
import { generatePositioningQueries } from "./_services/queries";
import { searchAndSiftTheses } from "./_services/sifting";
import { evaluateThesesInParallel } from "./_services/per-thesis-evaluation";
import { analyzePositioningJury } from "./_services/analysis";
import { savePositioningReportTransaction } from "./_services/decision-engine";
import { sanitizeAcademicDataBulk } from "@/lib/services/academic-sanitizer";
import type { JuryAnalysisResult } from "./_services/analysis";

/**
 * Runs query generation, Tezara search, and Cohere rerank; jury analysis and DB writes run separately.
 *
 * @param matrixInput - The thesis matrix used to derive the search queries.
 * @param flowId - The log flow identifier for structured logging.
 * @returns The sifted thesis list on success or an error message on failure.
 */
export async function runPositioningSearchAction(
  matrixInput: ThesisMatrix,
  flowId: string,
): Promise<{ success: true; theses: SiftedThesis[] } | { error: string }> {
  const log = new Logger(flowId);
  const positioningInput: Record<string, string> = {
    subjectProblem: matrixInput.subjectProblem ?? "",
    theoreticalFramework: matrixInput.theoreticalFramework ?? "",
    methodology: matrixInput.methodology ?? "",
  };

  const parsed = positioningMatrixSchema.safeParse(positioningInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const msg = firstIssue
      ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
      : "Form doğrulaması başarısız.";
    return { error: msg };
  }

  const validated = parsed.data;

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    log.info("generate_positioning_queries_start");
    const queries = await generatePositioningQueries(validated, log);
    log.info("generate_positioning_queries_success");

    const theses = await searchAndSiftTheses(queries, validated, log);

    return { success: true, theses };
  } catch (error) {
    log.error("positioning_search_failed", {
      error,
    });
    return {
      error:
        "Akademik arama sorguları üretilirken bir hata oluştu. Lütfen tekrar deneyin.",
    };
  }
}

/**
 * Runs the per-thesis relevance/originality evaluations in parallel and then the
 * final synthesis jury LLM over the relevant evaluated theses.
 *
 * @param matrixInput - The thesis matrix used for the jury evaluation.
 * @param theses - The sifted thesis candidates to analyze.
 * @param flowId - The log flow identifier for structured logging.
 * @returns The jury analysis result on success or an error message on failure.
 */
export async function runPositioningJuryAction(
  matrixInput: ThesisMatrix,
  theses: SiftedThesis[],
  flowId: string,
): Promise<
  { success: true; juryResult: JuryAnalysisResult } | { error: string }
> {
  const log = new Logger(flowId);
  const positioningInput: Record<string, string> = {
    subjectProblem: matrixInput.subjectProblem ?? "",
    theoreticalFramework: matrixInput.theoreticalFramework ?? "",
    methodology: matrixInput.methodology ?? "",
  };

  const parsed = positioningMatrixSchema.safeParse(positioningInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const msg = firstIssue
      ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
      : "Form doğrulaması başarısız.";
    return { error: msg };
  }

  const validated = parsed.data;

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const evaluatedTheses = await evaluateThesesInParallel(
      validated,
      theses,
      log,
    );

    const relevantTheses = evaluatedTheses.filter(
      (ev) => ev.evaluation.isRelevant,
    );

    log.info("positioning_jury_analysis_start");
    const juryResult = await analyzePositioningJury(
      validated,
      relevantTheses,
      log,
    );
    log.info("positioning_jury_analysis_success");

    const thesisTypeById = new Map<string, string>(
      relevantTheses.map((ev) => [String(ev.thesis.id), ev.thesis.thesisType]),
    );
    juryResult.recommendedTheses = juryResult.recommendedTheses.map((rec) => ({
      ...rec,
      thesisType: thesisTypeById.get(String(rec.externalThesisId)) || undefined,
    }));

    return { success: true, juryResult };
  } catch (error) {
    log.error("positioning_jury_failed", {
      error,
    });
    return {
      error:
        "Akademik jüri analizi sırasında bir hata oluştu. Lütfen tekrar deneyin.",
    };
  }
}

/**
 * Sanitizes the jury result and persists the positioning report to the database.
 *
 * @param matrixInput - The thesis matrix used for the positioning report.
 * @param juryResult - The jury analysis result to persist.
 * @param flowId - The log flow identifier for structured logging.
 * @returns A success marker or an error message on failure.
 */
export async function persistPositioningReportAction(
  matrixInput: ThesisMatrix,
  juryResult: JuryAnalysisResult,
  flowId: string,
): Promise<{ success: true } | { error: string }> {
  const log = new Logger(flowId);
  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const positioningInput: Record<string, string> = {
      subjectProblem: matrixInput.subjectProblem ?? "",
      theoreticalFramework: matrixInput.theoreticalFramework ?? "",
      methodology: matrixInput.methodology ?? "",
    };

    const parsed = positioningMatrixSchema.safeParse(positioningInput);
    if (!parsed.success) {
      return { error: "Form doğrulaması başarısız." };
    }
    const validated = parsed.data;

    if (juryResult.recommendedTheses.length > 0) {
      const itemsToSanitize = juryResult.recommendedTheses.map((t) => ({
        title: t.title || "",
        author: t.author || "",
      }));
      const sanitized = await sanitizeAcademicDataBulk(itemsToSanitize, log);
      juryResult.recommendedTheses = juryResult.recommendedTheses.map(
        (t, idx) => ({
          ...t,
          title: sanitized[idx]?.title || t.title,
          author: sanitized[idx]?.author || t.author,
        }),
      );
    }

    log.info("positioning_db_transaction_start");
    await savePositioningReportTransaction(
      session.userId,
      validated,
      juryResult,
    );
    log.info("positioning_db_transaction_success");

    return { success: true };
  } catch (error) {
    log.error("positioning_persist_failed", {
      error,
    });
    return {
      error:
        "Konumlandırma raporu kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.",
    };
  }
}

/**
 * Emits the final pipeline total-duration SUCCESS log line.
 *
 * @param flowId - The pipeline flow identifier.
 * @param durationMs - Total pipeline duration in milliseconds.
 */
export async function logPositioningPipelineSuccessAction(
  flowId: string,
  durationMs: number,
): Promise<void> {
  const log = new Logger(flowId);
  log.info("positioning_pipeline_success", {
    data: { durationMs: Math.round(durationMs) },
  });
}

/**
 * Returns the user's positioning record, pre-filling matrixInput from the matrix when missing.
 *
 * @returns The matching positioning record, a matrix-prefilled placeholder, or null.
 */
export async function getPositioningAction(): Promise<Positioning | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }

  try {
    const [record] = await db
      .select()
      .from(positioning)
      .where(eq(positioning.userId, session.userId));

    const [matrix] = await db
      .select()
      .from(matrices)
      .where(eq(matrices.userId, session.userId));

    if (matrix) {
      const currentMatrixInput = {
        subjectProblem: matrix.subjectProblem || "",
        theoreticalFramework: matrix.theoreticalFramework || "",
        methodology: matrix.methodology || "",
      };

      if (record) {
        const recordInput = record.matrixInput as Record<string, string> | null;
        const isMatching =
          recordInput &&
          recordInput.subjectProblem === currentMatrixInput.subjectProblem &&
          recordInput.theoreticalFramework ===
            currentMatrixInput.theoreticalFramework &&
          recordInput.methodology === currentMatrixInput.methodology;

        if (isMatching) {
          return record;
        }
      }

      return {
        id: record ? record.id : "prefilled-from-matrix",
        userId: session.userId,
        matrixInput: currentMatrixInput,
        globalStatus: null,
        gapAnalysisSummary: null,
        recommendedTheses: [],
        createdAt: matrix.createdAt,
        updatedAt: matrix.updatedAt,
      } as Positioning;
    }

    if (record) {
      return record;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Runs the full positioning pipeline: search, jury analysis, and persistence.
 *
 * @param matrixInput - The thesis matrix driving the whole pipeline.
 * @returns A success marker or an error message on failure.
 */
export async function runPositioningPipelineAction(
  matrixInput: ThesisMatrix,
): Promise<{ success: true } | { error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const pipelineStart = performance.now();

  const searchResult = await runPositioningSearchAction(
    matrixInput,
    log.flowId,
  );
  if ("error" in searchResult) {
    log.error("positioning_pipeline_failed", {
      error: searchResult.error,
    });
    return { error: searchResult.error };
  }

  const juryResult = await runPositioningJuryAction(
    matrixInput,
    searchResult.theses,
    log.flowId,
  );
  if ("error" in juryResult) {
    log.error("positioning_pipeline_failed", {
      error: juryResult.error,
    });
    return { error: juryResult.error };
  }

  const persistResult = await persistPositioningReportAction(
    matrixInput,
    juryResult.juryResult,
    log.flowId,
  );
  if ("error" in persistResult) {
    log.error("positioning_pipeline_failed", {
      error: persistResult.error,
    });
    return { error: persistResult.error };
  }

  log.info("positioning_pipeline_success", {
    data: { durationMs: Math.round(performance.now() - pipelineStart) },
  });

  return { success: true };
}
