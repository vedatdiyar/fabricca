"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "fabricca_session";

/**
 * Oturumu sonlandırır.
 * fabricca_session cookie'sini siler ve /login'e yönlendirir.
 */
export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  redirect("/login");
}
