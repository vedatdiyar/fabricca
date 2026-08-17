"use server";

import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { positioning, matrices } from "@/core/db/schema";
import type { Positioning } from "@/core/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { Logger } from "@/lib/logger";
import type { ThesisMatrix } from "@/lib/types";
import { positioningMatrixSchema } from "@/app/(onboarding)/onboarding/positioning/_services/validation";
import {
  searchAndSiftTheses,
  type SiftedThesis,
} from "@/app/(onboarding)/onboarding/positioning/_services/sifting";
import { evaluateThesesInParallel } from "@/app/(onboarding)/onboarding/positioning/_services/per-thesis-evaluation";
import { analyzePositioningJury } from "@/app/(onboarding)/onboarding/positioning/_services/analysis";
import { savePositioningReportTransaction } from "@/app/(onboarding)/onboarding/positioning/_services/decision-engine";
import { sanitizeAcademicDataBulk } from "@/core/services/academic";
import type { JuryAnalysisResult } from "@/app/(onboarding)/onboarding/positioning/_services/analysis";

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

    const theses = await searchAndSiftTheses(validated, log);

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
    const evalByThesisId = new Map(
      relevantTheses.map((ev) => [String(ev.thesis.id), ev.evaluation]),
    );
    juryResult.recommendedTheses = juryResult.recommendedTheses.map((rec) => {
      const ev = evalByThesisId.get(String(rec.externalThesisId));
      return {
        ...rec,
        strategicRole:
          rec.strategicRole || ev?.strategicRole || "BROAD_CONTEXT",
        literaturePosition: rec.literaturePosition || ev?.literaturePosition,
        thesisType:
          thesisTypeById.get(String(rec.externalThesisId)) || undefined,
      };
    });

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

    const [matrix] = await db
      .select({ id: matrices.id })
      .from(matrices)
      .where(eq(matrices.userId, session.userId));

    if (!matrix) {
      return { error: "Tez matrisi bulunamadı." };
    }

    log.info("positioning_db_transaction_start");
    await savePositioningReportTransaction(
      session.userId,
      matrix.id,
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
 * Emits the final pipeline total-duration TOTAL log line.
 *
 * @param flowId - The pipeline flow identifier.
 * @param durationMs - Total pipeline duration in milliseconds.
 */
export async function logPositioningPipelineSuccessAction(
  flowId: string,
  durationMs: number,
): Promise<void> {
  const log = new Logger(flowId);
  log.total("positioning_pipeline", Math.round(durationMs), {
    service: "positioning",
  });
}

/**
 * Returns the user's positioning record linked to their thesis matrix.
 *
 * @returns The matching positioning record or null.
 */
export async function getPositioningAction(): Promise<Positioning | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }

  try {
    const [matrix] = await db
      .select({ id: matrices.id })
      .from(matrices)
      .where(eq(matrices.userId, session.userId));

    if (!matrix) {
      return null;
    }

    const [record] = await db
      .select()
      .from(positioning)
      .where(eq(positioning.matrixId, matrix.id));

    return record ?? null;
  } catch {
    return null;
  }
}
