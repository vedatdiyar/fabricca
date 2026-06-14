"use server";

import { getSession } from "@/proxy";
import { createFlowId, Logger } from "@/lib/logger";
import type {
  EnhancedThesisData,
  OnboardingActionResult,
} from "@/lib/types";

/**
 * Kullanıcının onayladığı akademik olgunlaştırılmış tez matrisi verilerini onaylar.
 * Database-free mimari gereğince veritabanına yazma işlemi yapmaz.
 * Session kontrolü yapar ve doğrudan başarı döner.
 *
 * @param data - Onaylanmış EnhancedThesisData
 * @returns Başarılıysa { success: true }, hatalıysa { error: string }
 */
export async function confirmEnhancedThesisAction(
  data: EnhancedThesisData,
): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info({
    step: "confirm_enhanced_thesis",
    status: "START",
  });

  try {
    const session = await getSession();

    if (!session) {
      log.warn({
        step: "confirm_enhanced_thesis",
        status: "FAILED",
        diagnostics: {
          errorCode: "AUTH_ERROR",
          message: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
        },
      });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const duration = ((performance.now() - startTime) / 1000).toFixed(1) + "s";

    log.info({
      step: "confirm_enhanced_thesis",
      status: "SUCCESS",
      metrics: {
        duration,
        outputRows: 1,
      },
    });

    return { success: true };
  } catch (error) {
    log.error({
      step: "confirm_enhanced_thesis",
      status: "FAILED",
      diagnostics: {
        errorCode: "CONFIRM_ENRICHED_THESIS_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return { error: "Tez matrisi onaylanırken bir hata oluştu." };
  }
}
