"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createFlowId, Logger } from "@/lib/logger";
import { db } from "@/db";
import { users, thesisMatrices, originalityReports, tasks } from "@/db/schema";
import { getSession } from "@/session";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/constants/session";

/**
 * Oturumu sonlandırır.
 * fabricca_session cookie'sini siler ve /login'e yönlendirir.
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
      data: { reason: "Kullanıcı çıkış yaptı" },
    });
  } catch (err) {
    log.error("logout_failed", {
      service: "auth",
      error: err,
      data: { reason: "Çıkış sırasında hata oluştu" },
    });
  }

  redirect("/login");
}

/**
 * Onboarding sürecine verileri silmeden geri döner.
 * Sadece onboardingCompleted bayrağını false yapar, hiçbir veriyi silmez.
 * Kullanıcının onboarding adımlarını tekrar gözden geçirmesi için kullanılır.
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
      data: { reason: "Onboarding yeniden açılırken hata oluştu" },
    });
  }

  redirect("/onboarding");
}

/**
 * Onboarding sürecini sıfırlar.
 * Tez matrisi, özgünlük raporu, konu kutuları ve kütüphane kaynaklarını siler,
 * kullanıcının onboardingCompleted durumunu false yapar,
 * session cookie'sini günceller ve /onboarding sayfasına yönlendirir.
 *
 * Kullanıldığı yerler:
 *  - Header'daki "Süreci Sıfırla" butonu
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
      .delete(originalityReports)
      .where(eq(originalityReports.userId, session.userId));

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

    log.info("onboarding_reset_success", {
      service: "auth",
      data: { userId: session.userId },
    });
  } catch (err) {
    log.error("onboarding_reset_failed", {
      service: "auth",
      error: err,
      data: { reason: "Onboarding sıfırlama sırasında hata oluştu" },
    });
  }

  redirect("/onboarding");
}
