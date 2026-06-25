"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, originalityReports, thesisBoxes } from "@/db/schema";
import { getSession } from "@/session";
import { generateStructuredContent } from "@/lib/gemini";
import { SESSION_ERROR_MSG } from "@/lib/constants/session";
import { ThinkingLevel } from "@google/genai";
import { createFlowId, Logger } from "@/lib/logger";
import { invalidateOnboardingCache } from "@/lib/cache-tags";

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
    const theoreticalFramework = validateField(
      data.theoreticalFramework,
      "Kavramsal çerçeve",
    );
    if (!theoreticalFramework.valid)
      return { error: theoreticalFramework.error };
    const methodology = validateField(data.methodology, "Metodoloji");
    if (!methodology.valid) return { error: methodology.error };
    const researchScope = validateField(
      data.researchScope,
      "Araştırma kapsamı",
    );
    if (!researchScope.valid) return { error: researchScope.error };
    const mainClaim = validateField(data.mainClaim, "Temel iddia");
    if (!mainClaim.valid) return { error: mainClaim.error };

    const matrixEnhancementPrompt = buildMatrixEnhancementPrompt({
      studyTitle: studyTitle.value,
      researchQuestion: researchQuestion.value,
      theoreticalFramework: theoreticalFramework.value,
      methodology: methodology.value,
      researchScope: researchScope.value,
      mainClaim: mainClaim.value,
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
        temperature: 1.0,
        seed: 42,
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
      return { error: SESSION_ERROR_MSG };
    }

    await db
      .insert(thesisMatrices)
      .values({
        userId: session.userId,
        studyTitle: enhancedData.studyTitle,
        researchQuestion: enhancedData.researchQuestion,
        theoreticalFramework: enhancedData.theoreticalFramework,
        methodology: enhancedData.methodology,
        researchScope: enhancedData.researchScope,
        mainClaim: enhancedData.mainClaim,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: thesisMatrices.userId,
        set: {
          studyTitle: enhancedData.studyTitle,
          researchQuestion: enhancedData.researchQuestion,
          theoreticalFramework: enhancedData.theoreticalFramework,
          methodology: enhancedData.methodology,
          researchScope: enhancedData.researchScope,
          mainClaim: enhancedData.mainClaim,
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

    invalidateOnboardingCache();

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
