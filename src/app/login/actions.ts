"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getExpectedHash } from "@/lib/auth";

export type ActionResponse = {
  success: boolean;
  error?: string;
};

export async function loginAction(
  prevState: ActionResponse | null,
  formData: FormData,
): Promise<ActionResponse> {
  const passwordInput = formData.get("password") as string;
  const systemPassword = process.env.APP_PASSWORD;

  if (!systemPassword) {
    return {
      success: false,
      error: "Sistem erişim şifresi henüz .env.local dosyasında tanımlanmamış.",
    };
  }

  if (passwordInput === systemPassword) {
    const expectedHash = await getExpectedHash(systemPassword);
    const cookieStore = await cookies();

    cookieStore.set("academialab_session", expectedHash, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    redirect("/dashboard");
  }

  return {
    success: false,
    error: "Hatalı şifre. Lütfen tekrar deneyin.",
  };
}
