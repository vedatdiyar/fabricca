"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { thesisMatrices, users } from "@/db/schema";
import { getSession } from "@/proxy";
import { withDbLogging } from "@/lib/db-helpers";
import { generateStructuredContent } from "@/lib/gemini";
import { createFlowId, Logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";

import {
  enhancedThesisSchema,
  MATRIX_ENHANCEMENT_SYSTEM_INSTRUCTION,
  buildMatrixEnhancementPrompt,
} from "@/lib/prompts";
import type {
  EnhancedThesisData,
  EnhancedThesisActionResult,
} from "@/lib/types";

export type ThesisMatrixInput = {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  methodology: string;
  theoreticalFramework: string;
  historicalSpatialLimits: string;
};

const MIN_LENGTH = 3;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

function validateField(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length >= MIN_LENGTH ? trimmed : null;
}

/**
 * Tez Matrisi form verilerini doğrular, thesis_matrices tablosuna kaydeder,
 * ardından doğrulanmış verileri doğrudan Gemini API'sine göndererek
 * akademik olgunlaştırma yapar, sonuçları veri tabanına yazar ve
 * users tablosundaki onboardingStep değerini "thesis_matrix_enhanced"
 * olarak günceller.
 *
 * @param data - Tez Matrisi form verileri
 * @returns Başarılıysa { success: true, data: EnhancedThesisData },
 *          hatalıysa { error: string }
 */
export async function submitThesisMatrixAction(
  data: ThesisMatrixInput,
): Promise<EnhancedThesisActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();

    if (!session) {
      log.info("flow_complete", {
        service: "matrix",
        data: { reason: "Oturum bulunamadı" },
      });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const userId = session.userId;
    log.info("flow_start", { service: "matrix", data: { userId } });

    const studyTitle = validateField(data.studyTitle);
    if (!studyTitle) {
      log.info("flow_complete", {
        service: "matrix",
        data: { reason: "Validasyon: çalışma başlığı çok kısa" },
      });
      return { error: "Çalışma başlığı en az 3 karakter olmalıdır." };
    }

    const researchQuestion = validateField(data.researchQuestion);
    if (!researchQuestion) {
      log.info("flow_complete", {
        service: "matrix",
        data: { reason: "Validasyon: araştırma sorusu çok kısa" },
      });
      return { error: "Araştırma sorusu en az 3 karakter olmalıdır." };
    }

    const mainClaim = validateField(data.mainClaim);
    if (!mainClaim) {
      log.info("flow_complete", {
        service: "matrix",
        data: { reason: "Validasyon: temel iddia çok kısa" },
      });
      return { error: "Temel iddia en az 3 karakter olmalıdır." };
    }

    const methodology = validateField(data.methodology);
    if (!methodology) {
      log.info("flow_complete", {
        service: "matrix",
        data: { reason: "Validasyon: metodoloji çok kısa" },
      });
      return { error: "Metodoloji en az 3 karakter olmalıdır." };
    }

    const theoreticalFramework = validateField(data.theoreticalFramework);
    if (!theoreticalFramework) {
      log.info("flow_complete", {
        service: "matrix",
        data: { reason: "Validasyon: kuramsal çerçeve çok kısa" },
      });
      return { error: "Kuramsal çerçeve en az 3 karakter olmalıdır." };
    }

    const historicalSpatialLimits = validateField(data.historicalSpatialLimits);
    if (!historicalSpatialLimits) {
      log.info("flow_complete", {
        service: "matrix",
        data: { reason: "Validasyon: sınırlar çok kısa" },
      });
      return {
        error: "Tarihsel/mekânsal sınırlar en az 3 karakter olmalıdır.",
      };
    }

    // 1. DB: Ham matrisi kaydet
    await withDbLogging(
      () =>
        db
          .insert(thesisMatrices)
          .values({
            userId,
            studyTitle,
            researchQuestion,
            mainClaim,
            methodology,
            theoreticalFramework,
            historicalSpatialLimits,
          })
          .onConflictDoUpdate({
            target: thesisMatrices.userId,
            set: {
              studyTitle,
              researchQuestion,
              mainClaim,
              methodology,
              theoreticalFramework,
              historicalSpatialLimits,
              updatedAt: new Date(),
            },
          }),
      "save_matrix",
      log,
    );

    const matrixEnhancementPrompt = buildMatrixEnhancementPrompt({
      studyTitle,
      researchQuestion,
      mainClaim,
      methodology,
      theoreticalFramework,
      historicalSpatialLimits,
    });

    // 2. AI: Gemini ile akademik zenginleştirme (retry loop)
    let enhancedData: EnhancedThesisData | undefined;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        enhancedData = await generateStructuredContent<EnhancedThesisData>(
          "gemini-3.1-flash-lite",
          MATRIX_ENHANCEMENT_SYSTEM_INSTRUCTION,
          matrixEnhancementPrompt,
          enhancedThesisSchema,
          log,
          {
            thinkingConfig: null,
          },
        );
        break;
      } catch (e) {
        lastError = e;
        if (attempt < MAX_RETRIES) {
          log.warn("ai_retry_attempt", {
            service: "gemini",
            step: "akademik_zenginlestirme",
            data: { attempt, maxRetries: MAX_RETRIES, delayMs: RETRY_DELAY_MS },
          });
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        } else {
          log.error("ai_request_failed", {
            service: "gemini",
            step: "akademik_zenginlestirme",
            data: { attempt, maxRetries: MAX_RETRIES },
            error: e,
          });
        }
      }
    }

    if (!enhancedData) {
      throw lastError;
    }

    // 3. DB: Geliştirilmiş verileri matrise yaz
    await withDbLogging(
      () =>
        db
          .update(thesisMatrices)
          .set({
            studyTitle: enhancedData.academicStudyTitle,
            researchQuestion: enhancedData.literatureResearchQuestion,
            mainClaim: enhancedData.refinedThesisClaim,
            methodology: enhancedData.academicMethodologyDesign,
            theoreticalFramework:
              enhancedData.conceptualTheoreticalInfrastructure,
            historicalSpatialLimits: enhancedData.historicalSpatialLimits,
            updatedAt: new Date(),
          })
          .where(eq(thesisMatrices.userId, userId)),
      "update_matrix",
      log,
    );

    // 4. DB: Kullanıcı onboarding adımını güncelle
    await withDbLogging(
      () =>
        db
          .update(users)
          .set({ onboardingStep: "thesis_matrix_enhanced" })
          .where(eq(users.id, userId)),
      "update_step",
      log,
    );

    revalidatePath("/onboarding", "layout");
    log.info("flow_complete", { service: "matrix" });
    return { success: true, data: enhancedData };
  } catch (error) {
    log.error("flow_complete", {
      service: "matrix",
      error,
    });
    return {
      error: "Tez matrisi zenginleştirilirken bir hata oluştu.",
    };
  }
}
