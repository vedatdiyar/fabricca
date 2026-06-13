"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, originalityReports, users } from "@/db/schema";
import { getSession } from "@/proxy";
import { revalidatePath } from "next/cache";
import { withDbLogging } from "@/lib/db-helpers";
import { createFlowId, Logger } from "@/lib/logger";

/**
 * Resets the onboarding process for the currently authenticated user:
 * 1. Deletes the user's thesis matrix.
 * 2. Deletes the user's originality report.
 * 3. Sets the user's onboarding step back to 'thesis_matrix'.
 *
 * @returns An object indicating success or containing an error message.
 */
export async function resetOnboardingAction(): Promise<
  { success: boolean } | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      log.info("flow_complete", {
        service: "matrix",
        data: { reason: "No session found" },
      });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const userId = session.userId;
    log.info("flow_start", {
      service: "matrix",
      step: "reset_onboarding",
      data: { userId },
    });

    // 1. DB: Delete thesis matrix
    await withDbLogging(
      () => db.delete(thesisMatrices).where(eq(thesisMatrices.userId, userId)),
      "delete_matrix",
      log,
    );

    // 2. DB: Delete originality report
    await withDbLogging(
      () =>
        db
          .delete(originalityReports)
          .where(eq(originalityReports.userId, userId)),
      "delete_report",
      log,
    );

    // 3. DB: Update user onboardingStep to 'thesis_matrix'
    await withDbLogging(
      () =>
        db
          .update(users)
          .set({ onboardingStep: "thesis_matrix" })
          .where(eq(users.id, userId)),
      "update_step_to_matrix",
      log,
    );

    revalidatePath("/onboarding", "layout");
    log.info("flow_complete", { service: "matrix", step: "reset_onboarding" });
    return { success: true };
  } catch (error) {
    log.error("flow_complete", {
      service: "matrix",
      step: "reset_onboarding",
      error,
    });
    return {
      error: "Sıfırlama işlemi gerçekleştirilirken bir hata oluştu.",
    };
  }
}
