"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createFlowId, Logger } from "@/lib/logger";
import { db } from "@/db";
import {
  users,
  matrices,
  tasks,
  positioning,
  boxes,
  sources,
  sessions,
} from "@/db/schema";
import { deletePdfFromR2 } from "@/services/storage/r2";
import {
  getSession,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/session";
import {
  revalidateOnboardingPaths,
  invalidateOnboardingCache,
} from "@/lib/cache-tags";

/** Ends the current session, clearing the session cookie and redirecting to /login. */
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

    const userId = session.userId;

    // 1. Fetch PDF filenames to clean up from R2 before deleting database records
    try {
      const userSources = await db
        .select({ pdfFileName: sources.pdfFileName })
        .from(sources)
        .innerJoin(boxes, eq(sources.boxId, boxes.id))
        .innerJoin(matrices, eq(boxes.matrixId, matrices.id))
        .where(eq(matrices.userId, userId));

      for (const s of userSources) {
        if (s.pdfFileName) {
          try {
            await deletePdfFromR2(s.pdfFileName);
          } catch (r2Err) {
            log.error("reset_onboarding_r2_delete_failed", {
              service: "db",
              error: r2Err,
              data: { pdfFileName: s.pdfFileName },
            });
          }
        }
      }
    } catch (fetchErr) {
      log.error("reset_onboarding_sources_fetch_failed", {
        service: "db",
        error: fetchErr,
      });
    }

    // 2. Perform complete database deletion for all user-related data
    await db.transaction(async (tx) => {
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      await tx.delete(tasks).where(eq(tasks.userId, userId));
      await tx.delete(positioning).where(eq(positioning.userId, userId));
      await tx.delete(matrices).where(eq(matrices.userId, userId));
      await tx
        .update(users)
        .set({ onboardingCompleted: false })
        .where(eq(users.id, userId));
    });

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
      data: { userId },
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
