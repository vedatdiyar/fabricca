"use server";

import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import {
  revalidateOnboardingPaths,
  invalidateOnboardingCache,
} from "@/lib/cache-tags";
import { users } from "@/core/db/schema";
import { Logger, createFlowId } from "@/lib/logger";
import {
  getSession,
  writeSessionCookie,
  SESSION_ERROR_MSG,
} from "@/lib/session";
import type { OnboardingActionResult } from "@/lib/types";
import { handleActionError } from "@/lib/errors/handle-error";

/**
 * Marks onboarding as completed for the current user and updates the session cookie.
 *
 * @returns The action result indicating success or an error.
 */
export async function finalizeOnboardingAction(): Promise<OnboardingActionResult> {
  const log = new Logger(createFlowId());

  log.info("finalize_onboarding_start");

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    await db
      .update(users)
      .set({ onboardingCompleted: true })
      .where(eq(users.id, session.userId));

    try {
      await writeSessionCookie(session, true);
    } catch (err) {
      log.warn("finalize_onboarding_cookie_failed", {
        service: "literature",
        error: err,
      });
    }

    try {
      revalidateOnboardingPaths();
    } catch (err) {
      log.warn("finalize_onboarding_revalidate_failed", {
        service: "literature",
        error: err,
      });
    }

    invalidateOnboardingCache();

    log.info("finalize_onboarding_success");

    return { success: true };
  } catch (err) {
    log.error("finalize_onboarding_failed", {
      error: err,
    });
    return handleActionError(err);
  }
}
