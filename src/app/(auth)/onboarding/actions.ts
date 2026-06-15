"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, originalityReports, users } from "@/db/schema";
import { getSession } from "@/proxy";
import { revalidatePath } from "next/cache";
import { createFlowId, Logger } from "@/lib/logger";

/**
 * Resets the onboarding process for the currently authenticated user.
 * Deletes all onboarding data (thesis_matrices cascades to thesis_boxes
 * and library_resources) and sets onboardingCompleted to false.
 */
export async function resetOnboardingAction(): Promise<
  { success: boolean } | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  log.info({ step: "reset_onboarding", status: "START" });

  try {
    const session = await getSession();
    if (!session) return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };

    const userId = session.userId;

    // Delete thesis matrix (cascades to thesis_boxes → library_resources)
    await db.delete(thesisMatrices).where(eq(thesisMatrices.userId, userId));
    // Delete originality report
    await db.delete(originalityReports).where(eq(originalityReports.userId, userId));
    // Reset onboarding flag
    await db.update(users).set({ onboardingCompleted: false }).where(eq(users.id, userId));

    revalidatePath("/onboarding", "layout");

    log.info({ step: "reset_onboarding", status: "SUCCESS" });
    return { success: true };
  } catch (error) {
    log.error({ step: "reset_onboarding", status: "FAILED", diagnostics: { errorCode: "SYSTEM_ERROR", message: error instanceof Error ? error.message : String(error) } });
    return { error: "Sıfırlama işlemi gerçekleştirilirken bir hata oluştu." };
  }
}
