"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { thesisMatrices, users, originalityReports } from "@/db/schema";
import { getSession } from "@/proxy";
import { createFlowId, Logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { withDbLogging } from "@/lib/db-helpers";
import type { OnboardingActionResult } from "@/lib/types";

import { extractQueries } from "./_services/queries";
import {
  executeParallelSearch,
  evaluateTavilyResults,
} from "./_services/search";
import { siftAndFetchDetails } from "./_services/sifting";
import { analyze4Axes } from "./_services/analysis";
import { calculateOriginalityRisk } from "./_services/risk-calc";

/**
 * Starts the originality analysis process by executing factual and cross-language academic queries,
 * comparing the results, calculating originality risks, and saving the final report.
 * Updates the user's onboarding step to "originality_report_completed".
 *
 * @returns Success status or error message.
 */
export async function startOriginalityAnalysisAction(): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      log.info("flow_complete", {
        service: "originality",
        data: { reason: "Oturum bulunamadı" },
      });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const userId = session.userId;
    log.info("flow_start", {
      service: "originality",
      data: { userId },
    });

    // Step 0: Read thesis matrix from Database
    const [matrix] = await withDbLogging(
      () =>
        db
          .select()
          .from(thesisMatrices)
          .where(eq(thesisMatrices.userId, userId)),
      "read_matrix",
      log,
    );

    if (!matrix) {
      log.info("flow_complete", {
        service: "originality",
        data: { reason: "Matris bulunamadı" },
      });
      return {
        error: "Tez matrisi bulunamadı. Lütfen önce tez matrisini doldurun.",
      };
    }

    const {
      studyTitle,
      researchQuestion,
      mainClaim,
      methodology,
      theoreticalFramework,
      historicalSpatialLimits,
    } = matrix;

    // Step 1: AI - Generate Tavily and Tezara queries
    const { tavilyQueries, tezaraQueries } = await extractQueries(
      {
        studyTitle,
        researchQuestion,
        mainClaim,
        methodology,
        theoreticalFramework,
        historicalSpatialLimits,
      },
      log,
    );

    // Step 2: Parallel search execution
    const { tavilySearchResults, tezaraSearchResults } =
      await executeParallelSearch(tavilyQueries, tezaraQueries, log);

    // Step 3: AI - Evaluate Tavily fact-check results using Gemini
    const tavilyEvaluation = await evaluateTavilyResults(
      {
        studyTitle,
        researchQuestion,
        mainClaim,
        theoreticalFramework,
      },
      tavilySearchResults,
      log,
    );

    // Step 4 & 5: Sift candidate theses and fetch full details
    const validDetails = await siftAndFetchDetails(
      {
        studyTitle,
        researchQuestion,
        theoreticalFramework,
        methodology,
        historicalSpatialLimits,
      },
      tezaraSearchResults,
      log,
    );

    let tezaraResults;

    if (validDetails.length === 0) {
      tezaraResults = {
        originalityBadge: "ZERO_RISK" as const,
        overlapTable: [],
        strategicRecommendations:
          "Literatür taramasında doğrudan çakışan veya risk teşkil eden herhangi bir akademik çalışma tespit edilmemiştir. Araştırma tasarımınızın özgünlüğü maksimum seviyenedir.",
      };

      log.info("flow_complete", {
        service: "originality",
        step: "analyze",
        data: { result: "ZERO_RISK", reason: "Hiçbir tez detayı çekilemedi" },
      });
    } else {
      // Step 6: AI - Compare across four axes and calculate originality risks
      const geminiResult = await analyze4Axes(
        {
          studyTitle,
          researchQuestion,
          mainClaim,
          methodology,
          theoreticalFramework,
          historicalSpatialLimits,
          validDetails,
        },
        log,
      );

      tezaraResults = calculateOriginalityRisk(geminiResult, validDetails, log);
    }

    // Step 7: Save original report payload and update user onboarding step
    const databaseTavilyPayload = {
      items: tavilyEvaluation.items,
      briefingNote: tavilyEvaluation.briefingNote,
    };

    await withDbLogging(
      () =>
        db
          .insert(originalityReports)
          .values({
            userId,
            tavilyResults: databaseTavilyPayload,
            tezaraResults,
          })
          .onConflictDoUpdate({
            target: originalityReports.userId,
            set: {
              tavilyResults: databaseTavilyPayload,
              tezaraResults,
              updatedAt: new Date(),
            },
          }),
      "save_report",
      log,
    );

    await withDbLogging(
      () =>
        db
          .update(users)
          .set({ onboardingStep: "originality_report_completed" })
          .where(eq(users.id, userId)),
      "update_step",
      log,
    );

    revalidatePath("/onboarding");
    log.info("flow_complete", { service: "originality" });
    return { success: true };
  } catch (err) {
    log.error("flow_complete", {
      service: "originality",
      error: err,
    });
    return {
      error: `Özgünlük analizi sırasında bir hata oluştu: ${
        err instanceof Error ? err.message : "Bilinmeyen hata"
      }`,
    };
  }
}

/**
 * Kullanıcının onboarding_step'ini "originality_report_completed" olarak günceller.
 * Orta ve Düşük risk senaryolarında bir sonraki aşamaya geçmek için kullanılır.
 *
 * @returns Başarı durumu veya hata mesajı.
 */
export async function completeRiskStageAction(): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      log.info("flow_complete", {
        service: "originality",
        data: { reason: "Oturum bulunamadı", action: "completeRiskStage" },
      });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const userId = session.userId;
    log.info("flow_start", {
      service: "originality",
      data: { userId, action: "completeRiskStage" },
    });

    await withDbLogging(
      () =>
        db
          .update(users)
          .set({ onboardingStep: "originality_report_completed" })
          .where(eq(users.id, userId)),
      "update_user_step",
      log,
    );

    revalidatePath("/onboarding");
    log.info("flow_complete", { service: "originality", step: "risk_completed" });
    return { success: true };
  } catch (err) {
    log.error("flow_complete", {
      service: "originality",
      step: "completeRiskStage",
      error: err,
    });
    return {
      error: `Risk aşaması tamamlanırken bir hata oluştu: ${
        err instanceof Error ? err.message : "Bilinmeyen hata"
      }`,
    };
  }
}

/**
 * Retrieves the stored originality report for the current session user.
 *
 * @returns Stored report data or error message.
 */
export async function getStoredOriginalityReportAction() {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      log.info("flow_complete", {
        service: "originality",
        data: { reason: "Oturum bulunamadı" },
      });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    log.info("flow_start", {
      service: "originality",
      step: "read_report",
      data: { userId: session.userId },
    });

    const [report] = await withDbLogging(
      () =>
        db
          .select()
          .from(originalityReports)
          .where(eq(originalityReports.userId, session.userId)),
      "read_report",
      log,
    );

    if (!report) {
      log.info("flow_complete", {
        service: "originality",
        data: { reason: "Rapor bulunamadı" },
      });
      return { error: "Henüz özgünlük raporu oluşturulmamış." };
    }

    log.info("flow_complete", { service: "originality", step: "read_report" });

    return {
      success: true,
      data: {
        tavilyResults: report.tavilyResults,
        tezaraResults: report.tezaraResults,
      },
    };
  } catch (err) {
    log.error("flow_complete", {
      service: "originality",
      step: "rapor_oku",
      error: err,
    });
    return { error: "Özgünlük raporu yüklenirken bir hata oluştu." };
  }
}
