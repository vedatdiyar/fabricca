"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { thesisPositioning } from "@/db/schema";
import type { ThesisPositioning } from "@/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { invalidateOnboardingStepCache } from "@/lib/cache-tags";
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
 * Saves or updates the positioning matrix input for the authenticated user,
 * invalidating downstream caches.
 *
 * @param data - Raw input data submitted from the positioning form
 * @returns Object indicating success or error message
 */
export async function savePositioningMatrixAction(
  data: unknown,
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

  log.info("positioning_matrix_save_start", {
    service: "db",
    data: { context: "Saving positioning matrix" },
  });

  try {
    const session = await getSession();
    if (!session) {
      return { error: SESSION_ERROR_MSG };
    }

    await db
      .insert(thesisPositioning)
      .values({
        userId: session.userId,
        matrixInput: validated,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: thesisPositioning.userId,
        set: {
          matrixInput: validated,
          updatedAt: sql`now()`,
        },
      });

    invalidateOnboardingStepCache("positioning");

    log.info("positioning_matrix_save_success", {
      service: "db",
      durationMs: performance.now() - startTime,
      data: { context: "Saving positioning matrix" },
    });

    return { success: true };
  } catch (error) {
    log.error("positioning_matrix_save_failed", {
      service: "db",
      error,
      data: { context: "Saving positioning matrix" },
    });
    return { error: "Konumlandırma matrisi veritabanına kaydedilemedi." };
  }
}

/**
 * Fetches the existing positioning record for the authenticated user.
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

    return record ?? null;
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
 * Server Action executing FAZ 4 end-to-end positioning pipeline:
 * 1. Validates user's 5-field positioning matrix input.
 * 2. Runs FAZ 3 search & sifting (Gemini queries -> Tezara parallel search with limit 150 -> Cohere Rerank v4 Pro).
 * 3. Applies empirical threshold filtering (0.75 score bar, Min 10, Max 15) and runs Gemini Flash-Lite LLM Jury evaluation.
 * 4. Persists report data to `thesis_positioning` table in DB via transaction and invalidates step cache.
 * 5. Returns full analysis report, generated queries, and sifted theses to client.
 *
 * @param data - Raw form payload submitted from client.
 * @returns Object containing success flag, report, queries, and sifted theses, or error string.
 */
export async function runPositioningPipelineAction(data: unknown): Promise<
  | {
      success: true;
      report: JuryAnalysisResult;
      queries: GeneratedQueries;
      theses: SiftedThesis[];
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

  log.info("run_positioning_pipeline_start", {
    service: "positioning",
    filePath: "src/app/(onboarding)/onboarding/positioning/actions.ts",
    data: { context: "Executing full positioning pipeline (FAZ 3 + FAZ 4)" },
  });

  try {
    const session = await getSession();
    if (!session) {
      return { error: SESSION_ERROR_MSG };
    }

    // Step 1: FAZ 3 - Generate 3-tier search queries
    const queries = await generatePositioningQueries(validated, log);

    // Step 2: FAZ 3 - Search and Cohere rerank theses
    const theses = await searchAndSiftTheses(queries, validated, log);

    // Step 3: FAZ 4 - LLM Jury Analysis with empirical filter (0.75 threshold, Min 10, Max 15)
    const report = await analyzePositioningJury(validated, theses, log);

    // Step 4: FAZ 4 - Save transaction to DB and invalidate cache
    await savePositioningReportTransaction(
      session.userId,
      validated,
      report,
      log,
    );

    log.info("run_positioning_pipeline_success", {
      service: "positioning",
      filePath: "src/app/(onboarding)/onboarding/positioning/actions.ts",
      durationMs: performance.now() - startTime,
      data: {
        globalStatus: report.globalStatus,
        recommendedCount: report.recommendedTheses.length,
      },
    });

    return {
      success: true,
      report,
      queries,
      theses,
    };
  } catch (error) {
    log.error("run_positioning_pipeline_failed", {
      service: "positioning",
      filePath: "src/app/(onboarding)/onboarding/positioning/actions.ts",
      durationMs: performance.now() - startTime,
      error,
    });
    return {
      error:
        "Konumlandırma analizi ve jüri değerlendirmesi sırasında bir hata oluştu. Lütfen tekrar deneyin.",
    };
  }
}
