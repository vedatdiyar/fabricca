"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisPositioning, thesisMatrices } from "@/db/schema";
import type { ThesisPositioning } from "@/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { positioningMatrixSchema } from "./_lib/validation";
import {
  generatePositioningQueries,
  type GeneratedQueries,
} from "./_services/queries";
import { searchAndSiftTheses, type SiftedThesis } from "./_services/sifting";
import {
  analyzePositioningJury,
  type JuryAnalysisResult,
} from "./_services/analysis";
import { savePositioningReportTransaction } from "./_services/decision-engine";

/**
 * Fetches the existing positioning record for the authenticated user.
 * If no positioning record exists yet, attempts to pre-fill matrixInput
 * from the user's thesis_matrices record.
 *
 * @returns The user's positioning record or null if not found
 */
export async function getPositioningAction(): Promise<ThesisPositioning | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }

  try {
    const [record] = await db
      .select()
      .from(thesisPositioning)
      .where(eq(thesisPositioning.userId, session.userId));

    const [matrix] = await db
      .select()
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, session.userId));

    if (matrix) {
      const currentMatrixInput = {
        subjectAndProblem: matrix.researchCore || "",
        theoreticalFramework: matrix.framework || "",
        unitOfAnalysis: matrix.targetActors || "",
        methodology: matrix.mainClaim || "",
        scopeAndContext: matrix.context || "",
      };

      if (record) {
        const recordInput = record.matrixInput as Record<string, string> | null;
        const isMatching =
          recordInput &&
          recordInput.subjectAndProblem ===
            currentMatrixInput.subjectAndProblem &&
          recordInput.theoreticalFramework ===
            currentMatrixInput.theoreticalFramework &&
          recordInput.unitOfAnalysis === currentMatrixInput.unitOfAnalysis &&
          recordInput.methodology === currentMatrixInput.methodology &&
          recordInput.scopeAndContext === currentMatrixInput.scopeAndContext;

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
      } as ThesisPositioning;
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
 * Server Action executing FAZ 3 search pipeline:
 * 1. Validates user's 5-field positioning matrix input.
 * 2. Generates 3-tier academic search queries via Gemini Flash-Lite.
 * 3. Executes parallel searches on Tezara Meilisearch, filters out invalid abstracts & languages,
 *    and reranks candidates with Cohere Rerank v4 Pro.
 * 4. Returns sifted theses alongside generated queries.
 *
 * @param data - Raw form payload submitted from client.
 * @returns Object containing success flag, sifted theses, and generated queries, or error string.
 */
export async function executePositioningSearchAction(
  data: unknown,
): Promise<
  | { success: true; theses: SiftedThesis[]; queries: GeneratedQueries }
  | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  const parsed = positioningMatrixSchema.safeParse(data);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const msg = firstIssue
      ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
      : "Form doğrulaması başarısız.";
    return { error: msg };
  }

  const validated = parsed.data;

  log.info("execute_positioning_search_start", {
    service: "positioning",
    filePath: "src/app/(onboarding)/onboarding/positioning/actions.ts",
    data: { context: "Executing positioning search pipeline" },
  });

  try {
    const session = await getSession();
    if (!session) {
      return { error: SESSION_ERROR_MSG };
    }

    // Step 1: Generate 3-tier search queries with Gemini
    const queries = await generatePositioningQueries(validated, log);

    // Step 2: Parallel search Tezara, filter language/abstract, and Cohere rerank
    const theses = await searchAndSiftTheses(queries, validated, log);

    log.info("execute_positioning_search_success", {
      service: "positioning",
      filePath: "src/app/(onboarding)/onboarding/positioning/actions.ts",
      durationMs: performance.now() - startTime,
      data: { resultCount: theses.length },
    });

    return {
      success: true,
      theses,
      queries,
    };
  } catch (error) {
    log.error("execute_positioning_search_failed", {
      service: "positioning",
      filePath: "src/app/(onboarding)/onboarding/positioning/actions.ts",
      durationMs: performance.now() - startTime,
      error,
    });
    return {
      error:
        "Tez arama ve süzme işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.",
    };
  }
}

/**
 * Server Action that runs FAZ 4 LLM Jury analysis on pre-sifted theses.
 * Validates the matrix input, then runs Gemini Flash-Lite jury evaluation.
 *
 * @param data - Raw positioning matrix payload.
 * @param theses - Pre-sifted theses from executePositioningSearchAction.
 * @returns The jury analysis report on success, or an error string.
 */
export async function runPositioningJuryAction(
  data: unknown,
  theses: SiftedThesis[],
): Promise<
  | {
      success: true;
      report: JuryAnalysisResult;
    }
  | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  const parsed = positioningMatrixSchema.safeParse(data);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const msg = firstIssue
      ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
      : "Form doğrulaması başarısız.";
    return { error: msg };
  }

  const validated = parsed.data;

  log.info("run_positioning_jury_start", {
    service: "positioning",
    filePath: "src/app/(onboarding)/onboarding/positioning/actions.ts",
    data: { context: "Running LLM jury analysis on sifted theses" },
  });

  try {
    const session = await getSession();
    if (!session) {
      return { error: SESSION_ERROR_MSG };
    }

    const report = await analyzePositioningJury(validated, theses, log);

    log.info("run_positioning_jury_success", {
      service: "positioning",
      filePath: "src/app/(onboarding)/onboarding/positioning/actions.ts",
      durationMs: performance.now() - startTime,
      data: {
        globalStatus: report.globalStatus,
        recommendedCount: report.recommendedTheses.length,
      },
    });

    return { success: true, report };
  } catch (error) {
    log.error("run_positioning_jury_failed", {
      service: "positioning",
      filePath: "src/app/(onboarding)/onboarding/positioning/actions.ts",
      durationMs: performance.now() - startTime,
      error,
    });
    return {
      error: "Jüri analizi sırasında bir hata oluştu. Lütfen tekrar deneyin.",
    };
  }
}

/**
 * Server Action that persists the positioning report to the database and
 * invalidates the onboarding step cache. Does NOT clear downstream data
 * (the caller is responsible for that before calling this action).
 *
 * @param data - Raw positioning matrix payload.
 * @param report - The jury analysis result to persist.
 * @returns Success flag or error string.
 */
export async function savePositioningReportAction(
  data: unknown,
  report: JuryAnalysisResult,
): Promise<{ success: true } | { error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  const parsed = positioningMatrixSchema.safeParse(data);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const msg = firstIssue
      ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
      : "Form doğrulaması başarısız.";
    return { error: msg };
  }

  const validated = parsed.data;

  log.info("save_positioning_report_start", {
    service: "positioning",
    filePath: "src/app/(onboarding)/onboarding/positioning/actions.ts",
    data: { context: "Persisting positioning report to database" },
  });

  try {
    const session = await getSession();
    if (!session) {
      return { error: SESSION_ERROR_MSG };
    }

    await savePositioningReportTransaction(
      session.userId,
      validated,
      report,
      log,
    );

    log.info("save_positioning_report_success", {
      service: "positioning",
      filePath: "src/app/(onboarding)/onboarding/positioning/actions.ts",
      durationMs: performance.now() - startTime,
    });

    return { success: true };
  } catch (error) {
    log.error("save_positioning_report_failed", {
      service: "positioning",
      filePath: "src/app/(onboarding)/onboarding/positioning/actions.ts",
      durationMs: performance.now() - startTime,
      error,
    });
    return {
      error: "Rapor kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.",
    };
  }
}
