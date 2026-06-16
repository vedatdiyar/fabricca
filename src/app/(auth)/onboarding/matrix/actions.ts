"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, originalityReports, thesisBoxes } from "@/db/schema";
import { getSession } from "@/proxy";
import { generateStructuredContent } from "@/lib/gemini";
import { ThinkingLevel } from "@google/genai";
import { createFlowId, Logger } from "@/lib/logger";

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
 * Validates the raw matrix input, triggers Gemini to produce the academically
 * enhanced thesis matrix, writes the enriched data directly to thesis_matrices,
 * and returns the enhanced JSON to the client.
 */
export async function submitThesisMatrixAction(
  data: ThesisMatrixInput,
): Promise<EnhancedThesisActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info({ step: "matrix_enrichment", status: "START" });

  try {
    const session = await getSession();
    if (!session) {
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const studyTitle = validateField(data.studyTitle);
    const researchQuestion = validateField(data.researchQuestion);
    const mainClaim = validateField(data.mainClaim);
    const methodology = validateField(data.methodology);
    const theoreticalFramework = validateField(data.theoreticalFramework);
    const historicalSpatialLimits = validateField(data.historicalSpatialLimits);
    if (!studyTitle) return { error: "Çalışma başlığı en az 3 karakter olmalıdır." };
    if (!researchQuestion) return { error: "Araştırma sorusu en az 3 karakter olmalıdır." };
    if (!mainClaim) return { error: "Temel iddia en az 3 karakter olmalıdır." };
    if (!methodology) return { error: "Metodoloji en az 3 karakter olmalıdır." };
    if (!theoreticalFramework) return { error: "Kuramsal çerçeve en az 3 karakter olmalıdır." };
    if (!historicalSpatialLimits) return { error: "Tarihsel/mekânsal sınırlar en az 3 karakter olmalıdır." };

    const matrixEnhancementPrompt = buildMatrixEnhancementPrompt({
      studyTitle, researchQuestion, mainClaim, methodology, theoreticalFramework, historicalSpatialLimits,
    });

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
          { thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM } },
        );
        break;
      } catch (e) {
        lastError = e;
        if (attempt < MAX_RETRIES) {
          log.warn({ step: "matrix_enrichment", status: "RETRYING", attempt });
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        } else {
          log.error({ step: "matrix_enrichment", status: "FAILED", diagnostics: { errorCode: "GEMINI_ENRICHMENT_ERROR", message: e instanceof Error ? e.message : String(e) } });
        }
      }
    }

    if (!enhancedData) throw lastError;

    // Write enriched data directly to thesis_matrices (only enriched version, not raw form)
    await db
      .insert(thesisMatrices)
      .values({
        userId: session.userId,
        studyTitle: enhancedData.academicStudyTitle,
        researchQuestion: enhancedData.literatureResearchQuestion,
        mainClaim: enhancedData.refinedThesisClaim,
        methodology: enhancedData.academicMethodologyDesign,
        theoreticalFramework: enhancedData.conceptualTheoreticalInfrastructure,
        historicalSpatialLimits: enhancedData.historicalSpatialLimits,
        keywords: [],
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: thesisMatrices.userId,
        set: {
          studyTitle: enhancedData.academicStudyTitle,
          researchQuestion: enhancedData.literatureResearchQuestion,
          mainClaim: enhancedData.refinedThesisClaim,
          methodology: enhancedData.academicMethodologyDesign,
          theoreticalFramework: enhancedData.conceptualTheoreticalInfrastructure,
          historicalSpatialLimits: enhancedData.historicalSpatialLimits,
          keywords: [],
          updatedAt: new Date(),
        },
      });

    // Clear downstream data (originality_reports + thesis_boxes)
    await db.delete(originalityReports).where(eq(originalityReports.userId, session.userId));

    const [matrixRow] = await db
      .select({ id: thesisMatrices.id })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, session.userId));

    if (matrixRow) {
      await db.delete(thesisBoxes).where(eq(thesisBoxes.thesisMatrixId, matrixRow.id));
    }

    const duration = ((performance.now() - startTime) / 1000).toFixed(1) + "s";

    log.info({ step: "matrix_enrichment", status: "SUCCESS", metrics: { duration, outputRows: 1 } });

    return { success: true, data: enhancedData };
  } catch (error) {
    log.error({ step: "matrix_enrichment", status: "FAILED", diagnostics: { errorCode: "SYSTEM_ERROR", message: error instanceof Error ? error.message : String(error) } });
    return { error: "Tez matrisi zenginleştirilirken bir hata oluştu." };
  }
}
