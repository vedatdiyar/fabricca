"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, originalityReports, users } from "@/db/schema";
import { getSession } from "@/proxy";
import { revalidatePath } from "next/cache";
import { createFlowId, Logger } from "@/lib/logger";

/**
 * Resets the onboarding process for the currently authenticated user:
 * 1. Deletes the user's thesis matrix.
 * 2. Deletes the user's originality report.
 * 3. Sets the user's onboardingCompleted status to false.
 *
 * @returns An object indicating success or containing an error message.
 */
export async function resetOnboardingAction(): Promise<
  { success: boolean } | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info({
    step: "reset_onboarding",
    status: "START",
  });

  try {
    const session = await getSession();
    if (!session) {
      log.warn({
        step: "reset_onboarding",
        status: "FAILED",
        diagnostics: {
          errorCode: "AUTH_ERROR",
          message: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
        },
      });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const userId = session.userId;

    // 1. DB: Delete thesis matrix
    log.info({ step: "delete_matrix", status: "START", service: "db" });
    const t0 = performance.now();
    await db.delete(thesisMatrices).where(eq(thesisMatrices.userId, userId));
    log.info({ step: "delete_matrix", status: "SUCCESS", metrics: { durationMs: performance.now() - t0 }, service: "db" });

    // 2. DB: Delete originality report
    log.info({ step: "delete_report", status: "START", service: "db" });
    const t1 = performance.now();
    await db.delete(originalityReports).where(eq(originalityReports.userId, userId));
    log.info({ step: "delete_report", status: "SUCCESS", metrics: { durationMs: performance.now() - t1 }, service: "db" });

    // 3. DB: Update user onboardingCompleted to false
    log.info({ step: "update_completed_to_false", status: "START", service: "db" });
    const t2 = performance.now();
    await db.update(users).set({ onboardingCompleted: false }).where(eq(users.id, userId));
    log.info({ step: "update_completed_to_false", status: "SUCCESS", metrics: { durationMs: performance.now() - t2 }, service: "db" });

    revalidatePath("/onboarding", "layout");

    const duration = ((performance.now() - startTime) / 1000).toFixed(1) + "s";

    log.info({
      step: "reset_onboarding",
      status: "SUCCESS",
      metrics: {
        duration,
        outputRows: 1,
      },
    });
    return { success: true };
  } catch (error) {
    log.error({
      step: "reset_onboarding",
      status: "FAILED",
      diagnostics: {
        errorCode: "SYSTEM_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return {
      error: "Sıfırlama işlemi gerçekleştirilirken bir hata oluştu.",
    };
  }
}
