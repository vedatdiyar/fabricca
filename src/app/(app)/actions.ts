"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createFlowId, Logger } from "@/lib/logger";
import { SESSION_COOKIE_NAME } from "@/lib/constants/session";

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
