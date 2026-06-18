"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, originalityReports, thesisBoxes } from "@/db/schema";
import { getSession } from "@/proxy";
import { generateStructuredContent } from "@/lib/gemini";
import { ThinkingLevel } from "@google/genai";
import { createFlowId, Logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";

import {
  enhancedThesisSchema,
  buildMatrixEnhancementSystemInstruction,
  buildMatrixEnhancementPrompt,
} from "@/lib/prompts";
import { classifyError } from "@/lib/error-utils";
import type { ErrorScenario } from "@/lib/error-utils";
import {
  EnhancedThesisDataSchema,
  type EnhancedThesisData,
  type OnboardingFormData,
} from "@/lib/types";

const MIN_LENGTH = 3;
const MAX_LENGTH = 4000;

type ValidationResult =
  | { valid: true; value: string }
  | { valid: false; error: string };

function validateField(
  value: string | undefined,
  label: string,
): ValidationResult {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length < MIN_LENGTH) {
    return {
      valid: false,
      error: `${label} en az ${MIN_LENGTH} karakter olmalıdır.`,
    };
  }
  if (trimmed.length > MAX_LENGTH) {
    return {
      valid: false,
      error: `${label} en fazla ${MAX_LENGTH} karakter olabilir.`,
    };
  }
  return { valid: true, value: trimmed };
}

/**
 * Validates the raw thesis matrix input, sends it to Gemini for academic
 * enrichment, and returns the enhanced result WITHOUT writing to the database.
 *
 * @param data - Raw thesis matrix fields from the onboarding form
 * @returns Enhanced thesis data on success, or a validation/Gemini error message
 */
export async function enrichThesisMatrixAction(
  data: OnboardingFormData,
): Promise<{ success: true; data: EnhancedThesisData } | { error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info("matrix_enrichment_start", {
    service: "matrix",
    data: { context: "Tez matrisi zenginleştirme" },
  });

  try {
    const studyTitle = validateField(data.studyTitle, "Çalışma başlığı");
    if (!studyTitle.valid) return { error: studyTitle.error };
    const researchQuestion = validateField(
      data.researchQuestion,
      "Araştırma sorusu",
    );
    if (!researchQuestion.valid) return { error: researchQuestion.error };
    const mainClaim = validateField(data.mainClaim, "Temel iddia");
    if (!mainClaim.valid) return { error: mainClaim.error };
    const theoreticalFramework = validateField(
      data.theoreticalFramework,
      "Kuramsal çerçeve",
    );
    if (!theoreticalFramework.valid)
      return { error: theoreticalFramework.error };
    const methodology = validateField(data.methodology, "Metodoloji");
    if (!methodology.valid) return { error: methodology.error };
    const dataStrategy = validateField(data.dataStrategy, "Veri stratejisi");
    if (!dataStrategy.valid) return { error: dataStrategy.error };
    const historicalLimits = validateField(
      data.historicalLimits,
      "Tarihsel sınırlar",
    );
    if (!historicalLimits.valid) return { error: historicalLimits.error };
    const spatialLimits = validateField(
      data.spatialLimits,
      "Mekânsal sınırlar",
    );
    if (!spatialLimits.valid) return { error: spatialLimits.error };
    const analyticalFocus = validateField(
      data.analyticalFocus,
      "Analitik odak",
    );
    if (!analyticalFocus.valid) return { error: analyticalFocus.error };

    const matrixEnhancementPrompt = buildMatrixEnhancementPrompt({
      studyTitle: studyTitle.value,
      researchQuestion: researchQuestion.value,
      mainClaim: mainClaim.value,
      theoreticalFramework: theoreticalFramework.value,
      methodology: methodology.value,
      dataStrategy: dataStrategy.value,
      historicalLimits: historicalLimits.value,
      spatialLimits: spatialLimits.value,
      analyticalFocus: analyticalFocus.value,
    });

    const enhancedData = await generateStructuredContent<EnhancedThesisData>(
      "gemini-3.1-flash-lite",
      buildMatrixEnhancementSystemInstruction(),
      matrixEnhancementPrompt,
      enhancedThesisSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        zodSchema: EnhancedThesisDataSchema,
      },
    );

    log.info("matrix_enrichment_success", {
      service: "matrix",
      durationMs: performance.now() - startTime,
      data: { count: 1, context: "Tez matrisi zenginleştirme" },
    });

    return { success: true, data: enhancedData };
  } catch (error) {
    log.error("matrix_enrichment_failed", {
      service: "matrix",
      error,
      data: { context: "Tez matrisi zenginleştirme" },
    });

    const scenario = classifyError(error);
    const errorMessages: Record<ErrorScenario, string> = {
      quota:
        "Günlük yapay zeka analiz limitine ulaşıldı. Lütfen yarın tekrar deneyin.",
      network:
        "Yapay zeka servisine bağlanılamadı. İnternet bağlantınızı kontrol edin ve tekrar deneyin.",
      system: "Tez matrisi zenginleştirilirken bir hata oluştu.",
    };

    return { error: errorMessages[scenario] };
  }
}

/**
 * Persists a previously enriched thesis matrix to the database and clears any
 * downstream analysis data (originality reports and thesis boxes) that may now
 * be stale.
 *
 * @param enhancedData - The academically enriched thesis matrix data
 * @returns Success confirmation or an error message
 */
export async function saveEnrichedMatrixAction(
  enhancedData: EnhancedThesisData,
): Promise<{ success: true } | { error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info("matrix_save_start", {
    service: "db",
    data: { context: "Tez matrisi kaydetme" },
  });

  try {
    const session = await getSession();
    if (!session) {
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    await db
      .insert(thesisMatrices)
      .values({
        userId: session.userId,
        studyTitle: enhancedData.academicStudyTitle,
        researchQuestion: enhancedData.literatureResearchQuestion,
        mainClaim: enhancedData.refinedThesisClaim,
        theoreticalFramework: enhancedData.conceptualTheoreticalInfrastructure,
        methodology: enhancedData.academicMethodologyDesign,
        dataStrategy: enhancedData.dataStrategy,
        historicalLimits: enhancedData.historicalLimits,
        spatialLimits: enhancedData.spatialLimits,
        analyticalFocus: enhancedData.analyticalFocus,
        keywords: [],
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: thesisMatrices.userId,
        set: {
          studyTitle: enhancedData.academicStudyTitle,
          researchQuestion: enhancedData.literatureResearchQuestion,
          mainClaim: enhancedData.refinedThesisClaim,
          theoreticalFramework:
            enhancedData.conceptualTheoreticalInfrastructure,
          methodology: enhancedData.academicMethodologyDesign,
          dataStrategy: enhancedData.dataStrategy,
          historicalLimits: enhancedData.historicalLimits,
          spatialLimits: enhancedData.spatialLimits,
          analyticalFocus: enhancedData.analyticalFocus,
          keywords: [],
          updatedAt: sql`now()`,
        },
      });

    await db
      .delete(originalityReports)
      .where(eq(originalityReports.userId, session.userId));

    const [matrixRow] = await db
      .select({ id: thesisMatrices.id })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, session.userId));

    if (matrixRow) {
      await db
        .delete(thesisBoxes)
        .where(eq(thesisBoxes.thesisMatrixId, matrixRow.id));
    }

    revalidatePath("/onboarding/matrix");
    revalidatePath("/onboarding/enrichment");

    log.info("matrix_save_success", {
      service: "db",
      durationMs: performance.now() - startTime,
      data: { context: "Tez matrisi kaydetme" },
    });

    return { success: true };
  } catch (error) {
    log.error("matrix_save_failed", {
      service: "db",
      error,
      data: { context: "Tez matrisi kaydetme" },
    });
    return { error: "Matris veri tabanına kaydedilirken bir hata oluştu." };
  }
}
