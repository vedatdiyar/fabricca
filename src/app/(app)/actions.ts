"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createFlowId, Logger } from "@/lib/logger";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  getSession,
  writeSessionCookie,
  clearSessionCookie,
} from "@/lib/session";
import { resetUserOnboardingData } from "@/features/onboarding/services/reset-onboarding";
import {
  revalidateOnboardingPaths,
  invalidateOnboardingCache,
} from "@/lib/cache-tags";

/** Ends the current session, clearing the session cookie and redirecting to /login. */
export async function logoutAction() {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    await clearSessionCookie();

    log.info("logout_success", {
      service: "auth",
      data: { reason: "User logged out" },
    });
  } catch (err) {
    log.error("logout_failed", {
      service: "auth",
      error: err,
      data: { reason: "Error during logout" },
    });
  }

  redirect("/login");
}

/** Returns to the onboarding flow without deleting data by setting onboardingCompleted to false. */
export async function reopenOnboardingAction() {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      redirect("/login");
      return;
    }

    await db
      .update(users)
      .set({ onboardingCompleted: false })
      .where(eq(users.id, session.userId));

    await writeSessionCookie(session, false);

    log.info("onboarding_reopen_success", {
      service: "auth",
      data: { userId: session.userId },
    });
  } catch (err) {
    log.error("onboarding_reopen_failed", {
      service: "auth",
      error: err,
      data: { reason: "Error reopening onboarding" },
    });
  }

  redirect("/onboarding");
}

/** Resets the entire onboarding process and deletes ALL user data (R2 PDFs, chat sessions, tasks, positioning, matrices). */
export async function resetOnboardingAction() {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      redirect("/login");
      return;
    }

    await resetUserOnboardingData(session.userId, log);

    await writeSessionCookie(session, false);

    revalidateOnboardingPaths();
    invalidateOnboardingCache();

    log.info("onboarding_reset_success", {
      service: "auth",
      data: { userId: session.userId },
    });
  } catch (err) {
    log.error("onboarding_reset_failed", {
      service: "auth",
      error: err,
      data: { reason: "Error resetting onboarding" },
    });
  }

  redirect("/onboarding");
}
