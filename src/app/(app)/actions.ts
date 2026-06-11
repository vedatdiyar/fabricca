"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createFlowId, Logger } from "@/lib/logger";

const COOKIE_NAME = "fabricca_session";

/**
 * Oturumu sonlandırır.
 * fabricca_session cookie'sini siler ve /login'e yönlendirir.
 */
export async function logoutAction() {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  log.info("login_failed", {
    service: "auth",
    data: { reason: "Kullanıcı çıkış yaptı" },
  });

  redirect("/login");
}
