"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createFlowId, Logger } from "@/lib/logger";
import { db } from "@/db";
import { users, thesisMatrices, tasks } from "@/db/schema";
import {
  getSession,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/session";
import {
  revalidateOnboardingPaths,
  invalidateOnboardingCache,
} from "@/lib/cache-tags";

/**
 * Ends the current session.
 * Clears the fabricca_session cookie and redirects to /login.
 */
export async function logoutAction() {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

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

/**
 * Returns to the onboarding flow without deleting any data.
 * Only sets the onboardingCompleted flag to false so the user can
 * review the onboarding steps again.
 */
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

    const cookieStore = await cookies();
    cookieStore.set(
      SESSION_COOKIE_NAME,
      JSON.stringify({
        userId: session.userId,
        name: session.name,
        onboardingCompleted: false,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
      },
    );

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

/**
 * Resets the entire onboarding process.
 * Deletes tasks, originality reports, and thesis matrices for the user,
 * sets onboardingCompleted to false, updates the session cookie, and
 * redirects to /onboarding.
 *
 * Used by:
 *  - The "Süreci Sıfırla" button in the header
 */
export async function resetOnboardingAction() {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      redirect("/login");
      return;
    }

    await db.delete(tasks).where(eq(tasks.userId, session.userId));

    await db
      .delete(thesisMatrices)
      .where(eq(thesisMatrices.userId, session.userId));

    await db
      .update(users)
      .set({ onboardingCompleted: false })
      .where(eq(users.id, session.userId));

    const cookieStore = await cookies();
    cookieStore.set(
      SESSION_COOKIE_NAME,
      JSON.stringify({
        userId: session.userId,
        name: session.name,
        onboardingCompleted: false,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
      },
    );

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
