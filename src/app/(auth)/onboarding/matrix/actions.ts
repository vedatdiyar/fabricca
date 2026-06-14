"use server";

import { getSession } from "@/proxy";
import { generateStructuredContent } from "@/lib/gemini";
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
 * Validates the raw matrix input and triggers Gemini to produce the academically
 * enhanced thesis matrix parameters. Returns the raw JSON to the client.
 * Bypasses database operations completely.
 *
 * @param data - The raw thesis matrix input values.
 * @returns Object with success and enhanced data, or error message.
 */
export async function submitThesisMatrixAction(
  data: ThesisMatrixInput,
): Promise<EnhancedThesisActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info({
    step: "matrix_enrichment",
    status: "START",
  });

  try {
    const session = await getSession();

    if (!session) {
      log.warn({
        step: "matrix_enrichment",
        status: "FAILED",
        diagnostics: {
          errorCode: "AUTH_ERROR",
          message: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
        },
      });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const studyTitle = validateField(data.studyTitle);
    if (!studyTitle) {
      log.warn({
        step: "matrix_enrichment",
        status: "FAILED",
        diagnostics: {
          errorCode: "VALIDATION_ERROR",
          message: "Çalışma başlığı en az 3 karakter olmalıdır.",
        },
      });
      return { error: "Çalışma başlığı en az 3 karakter olmalıdır." };
    }

    const researchQuestion = validateField(data.researchQuestion);
    if (!researchQuestion) {
      log.warn({
        step: "matrix_enrichment",
        status: "FAILED",
        diagnostics: {
          errorCode: "VALIDATION_ERROR",
          message: "Araştırma sorusu en az 3 karakter olmalıdır.",
        },
      });
      return { error: "Araştırma sorusu en az 3 karakter olmalıdır." };
    }

    const mainClaim = validateField(data.mainClaim);
    if (!mainClaim) {
      log.warn({
        step: "matrix_enrichment",
        status: "FAILED",
        diagnostics: {
          errorCode: "VALIDATION_ERROR",
          message: "Temel iddia en az 3 karakter olmalıdır.",
        },
      });
      return { error: "Temel iddia en az 3 karakter olmalıdır." };
    }

    const methodology = validateField(data.methodology);
    if (!methodology) {
      log.warn({
        step: "matrix_enrichment",
        status: "FAILED",
        diagnostics: {
          errorCode: "VALIDATION_ERROR",
          message: "Metodoloji en az 3 karakter olmalıdır.",
        },
      });
      return { error: "Metodoloji en az 3 karakter olmalıdır." };
    }

    const theoreticalFramework = validateField(data.theoreticalFramework);
    if (!theoreticalFramework) {
      log.warn({
        step: "matrix_enrichment",
        status: "FAILED",
        diagnostics: {
          errorCode: "VALIDATION_ERROR",
          message: "Kuramsal çerçeve en az 3 karakter olmalıdır.",
        },
      });
      return { error: "Kuramsal çerçeve en az 3 karakter olmalıdır." };
    }

    const historicalSpatialLimits = validateField(data.historicalSpatialLimits);
    if (!historicalSpatialLimits) {
      log.warn({
        step: "matrix_enrichment",
        status: "FAILED",
        diagnostics: {
          errorCode: "VALIDATION_ERROR",
          message: "Tarihsel/mekânsal sınırlar en az 3 karakter olmalıdır.",
        },
      });
      return {
        error: "Tarihsel/mekânsal sınırlar en az 3 karakter olmalıdır.",
      };
    }

    const matrixEnhancementPrompt = buildMatrixEnhancementPrompt({
      studyTitle,
      researchQuestion,
      mainClaim,
      methodology,
      theoreticalFramework,
      historicalSpatialLimits,
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
          {
            thinkingConfig: null,
          },
        );
        break;
      } catch (e) {
        lastError = e;
        if (attempt < MAX_RETRIES) {
          log.warn({
            step: "matrix_enrichment",
            status: "RETRYING",
            attempt,
            maxRetries: MAX_RETRIES,
            delayMs: RETRY_DELAY_MS,
          });
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        } else {
          log.error({
            step: "matrix_enrichment",
            status: "FAILED",
            diagnostics: {
              errorCode: "GEMINI_ENRICHMENT_ERROR",
              message: e instanceof Error ? e.message : String(e),
              model: "gemini-3.1-flash-lite",
            },
          });
        }
      }
    }

    if (!enhancedData) {
      throw lastError;
    }

    const duration = ((performance.now() - startTime) / 1000).toFixed(1) + "s";
    const tokens = log.lastTokens || { input: 0, output: 0 };

    log.info({
      step: "matrix_enrichment",
      status: "SUCCESS",
      metrics: {
        duration,
        tokens: {
          prompt: tokens.input ?? 0,
          completion: tokens.output ?? 0,
        },
        outputRows: 1,
      },
    });

    return { success: true, data: enhancedData };
  } catch (error) {
    log.error({
      step: "matrix_enrichment",
      status: "FAILED",
      diagnostics: {
        errorCode: "SYSTEM_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return {
      error: "Tez matrisi zenginleştirilirken bir hata oluştu.",
    };
  }
}
