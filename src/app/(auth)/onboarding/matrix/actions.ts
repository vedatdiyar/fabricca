"use server";

import { eq } from "drizzle-orm";
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
import type { EnhancedThesisData } from "@/lib/types";

export type ThesisMatrixInput = {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  dataStrategy: string;
  historicalLimits: string;
  spatialLimits: string;
  analyticalFocus: string;
};

const MIN_LENGTH = 3;

function validateField(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length >= MIN_LENGTH ? trimmed : null;
}

/**
 * Validates the raw thesis matrix input, sends it to Gemini for academic
 * enrichment, and returns the enhanced result WITHOUT writing to the database.
 *
 * @param data - Raw thesis matrix fields from the onboarding form
 * @returns Enhanced thesis data on success, or a validation/Gemini error message
 */
export async function enrichThesisMatrixAction(
  data: ThesisMatrixInput,
): Promise<{ success: true; data: EnhancedThesisData } | { error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info("matrix_enrichment_start", {
    service: "matrix",
    data: { context: "Tez matrisi zenginleştirme" },
  });

  try {
    const studyTitle = validateField(data.studyTitle);
    const researchQuestion = validateField(data.researchQuestion);
    const mainClaim = validateField(data.mainClaim);
    const theoreticalFramework = validateField(data.theoreticalFramework);
    const methodology = validateField(data.methodology);
    const dataStrategy = validateField(data.dataStrategy);
    const historicalLimits = validateField(data.historicalLimits);
    const spatialLimits = validateField(data.spatialLimits);
    const analyticalFocus = validateField(data.analyticalFocus);
    if (!studyTitle)
      return { error: "Çalışma başlığı en az 3 karakter olmalıdır." };
    if (!researchQuestion)
      return { error: "Araştırma sorusu en az 3 karakter olmalıdır." };
    if (!mainClaim) return { error: "Temel iddia en az 3 karakter olmalıdır." };
    if (!theoreticalFramework)
      return { error: "Kuramsal çerçeve en az 3 karakter olmalıdır." };
    if (!methodology)
      return { error: "Metodoloji en az 3 karakter olmalıdır." };
    if (!dataStrategy)
      return { error: "Veri stratejisi en az 3 karakter olmalıdır." };
    if (!historicalLimits)
      return { error: "Tarihsel sınırlar en az 3 karakter olmalıdır." };
    if (!spatialLimits)
      return { error: "Mekânsal sınırlar en az 3 karakter olmalıdır." };
    if (!analyticalFocus)
      return { error: "Analitik odak en az 3 karakter olmalıdır." };

    const matrixEnhancementPrompt = buildMatrixEnhancementPrompt({
      studyTitle,
      researchQuestion,
      mainClaim,
      theoreticalFramework,
      methodology,
      dataStrategy,
      historicalLimits,
      spatialLimits,
      analyticalFocus,
    });

    const enhancedData = await generateStructuredContent<EnhancedThesisData>(
      "gemini-3.1-flash-lite",
      buildMatrixEnhancementSystemInstruction(),
      matrixEnhancementPrompt,
      enhancedThesisSchema,
      log,
      { thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM } },
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
    return { error: "Tez matrisi zenginleştirilirken bir hata oluştu." };
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
        updatedAt: new Date(),
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
          updatedAt: new Date(),
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
