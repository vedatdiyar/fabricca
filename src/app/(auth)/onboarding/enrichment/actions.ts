"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, users } from "@/db/schema";
import { getSession } from "@/proxy";
import { withDbLogging } from "@/lib/db-helpers";
import { createFlowId, Logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import type {
  EnhancedThesisData,
  OnboardingActionResult,
  EnhancedThesisActionResult,
} from "@/lib/types";

/**
 * Kullanıcının daha önce kaydedilmiş akademik olgunlaştırılmış tez matrisi
 * verilerini thesis_matrices tablosundan okur.
 *
 * @returns Başarılıysa { success: true, data: EnhancedThesisData },
 *          hatalıysa { error: string }
 */
export async function getStoredEnhancedDataAction(): Promise<EnhancedThesisActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();

    if (!session) {
      log.info("flow_complete", {
        service: "enrichment",
        data: { reason: "Oturum bulunamadı" },
      });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    log.info("flow_start", {
      service: "enrichment",
      step: "fetch_data",
      data: { userId: session.userId },
    });

    const [matrix] = await withDbLogging(
      () => db
        .select()
        .from(thesisMatrices)
        .where(eq(thesisMatrices.userId, session.userId)),
      "read_matrix",
      log,
    );

    if (!matrix) {
      log.info("flow_complete", {
        service: "enrichment",
        data: { reason: "Matris bulunamadı" },
      });
      return {
        error: "Henüz bir tez matrisi oluşturulmamış.",
      };
    }

    log.info("flow_complete", { service: "enrichment" });

    return {
      success: true,
      data: {
        academicStudyTitle: matrix.studyTitle,
        literatureResearchQuestion: matrix.researchQuestion,
        refinedThesisClaim: matrix.mainClaim,
        conceptualTheoreticalInfrastructure: matrix.theoreticalFramework,
        academicMethodologyDesign: matrix.methodology,
        historicalSpatialLimits: matrix.historicalSpatialLimits,
      },
    };
  } catch (error) {
    log.error("flow_complete", {
      service: "enrichment",
      step: "fetch_data",
      error,
    });
    return { error: "Tez matrisi okunurken bir hata oluştu." };
  }
}

/**
 * Kullanıcının onayladığı akademik olgunlaştırılmış tez matrisi verilerini
 * thesis_matrices tablosundaki mevcut 6 kolona yazar ve users tablosundaki
 * onboardingStep değerini "originality_report" olarak günceller.
 *
 * @param data - Onaylanmış EnhancedThesisData
 * @returns Başarılıysa { success: true }, hatalıysa { error: string }
 */
export async function confirmEnhancedThesisAction(
  data: EnhancedThesisData,
): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();

    if (!session) {
      log.info("flow_complete", {
        service: "enrichment",
        step: "confirm",
        data: { reason: "Oturum bulunamadı" },
      });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const userId = session.userId;
    log.info("flow_start", {
      service: "enrichment",
      step: "confirm",
      data: { userId },
    });

    // 1. DB: Matris güncelle
    await withDbLogging(
      () => db
        .update(thesisMatrices)
        .set({
          studyTitle: data.academicStudyTitle,
          researchQuestion: data.literatureResearchQuestion,
          mainClaim: data.refinedThesisClaim,
          methodology: data.academicMethodologyDesign,
          theoreticalFramework: data.conceptualTheoreticalInfrastructure,
          historicalSpatialLimits: data.historicalSpatialLimits,
          updatedAt: new Date(),
        })
        .where(eq(thesisMatrices.userId, userId)),
      "confirm_matrix",
      log,
    );

    // 2. DB: Adım güncelle
    await withDbLogging(
      () => db
        .update(users)
        .set({ onboardingStep: "originality_report" })
        .where(eq(users.id, userId)),
      "update_step",
      log,
    );

    revalidatePath("/onboarding");
    log.info("flow_complete", { service: "enrichment", step: "confirm" });
    return { success: true };
  } catch (error) {
    log.error("flow_complete", {
      service: "enrichment",
      step: "confirm",
      error,
    });
    return { error: "Tez matrisi onaylanırken bir hata oluştu." };
  }
}
