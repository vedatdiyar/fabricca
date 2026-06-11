"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/proxy";
import { withDbLogging } from "@/lib/db-helpers";
import { createFlowId, Logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import type { OnboardingActionResult } from "@/lib/types";

/**
 * Onboarding adımını tamamen "completed" olarak günceller.
 */
export async function completeOnboardingAction(): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      log.info("flow_complete", {
        service: "flow",
        data: { reason: "Oturum bulunamadı" },
      });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    log.info("flow_start", {
      service: "flow",
      data: { userId: session.userId },
    });

    await withDbLogging(
      () => db
        .update(users)
        .set({ onboardingStep: "completed" })
        .where(eq(users.id, session.userId)),
      "complete_onboarding",
      log,
    );

    revalidatePath("/onboarding");
    log.info("flow_complete", { service: "flow" });
    return { success: true };
  } catch (err) {
    log.error("flow_complete", { service: "flow", error: err });
    return { error: "Onboarding tamamlanırken bir hata oluştu." };
  }
}
