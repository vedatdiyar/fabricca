"use server";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { compare } from "bcrypt-ts";
import { db } from "@/db";
import { users } from "@/db/schema";

export type LoginResult =
  | { success: true; error?: never }
  | { success?: never; error: string };

const COOKIE_NAME = "fabricca_session";

/**
 * E-posta ve şifre ile kullanıcı girişini doğrular.
 * Başarılıysa fabricca_session cookie'si oluşturur.
 * Hata mesajları kullanıcı dostudur ve hassas detay içermez.
 *
 * @param email - Kullanıcı e-posta adresi
 * @param password - Kullanıcı şifresi (düz metin, bcrypt ile karşılaştırılır)
 * @returns Başarılıysa { success: true }, hatalıysa { error: string }
 */
export async function loginAction(
  email: string,
  password: string,
): Promise<LoginResult> {
  if (!email || !password) {
    return { error: "E-posta ve şifre gereklidir." };
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email));

    if (!user) {
      return { error: "E-posta veya şifre hatalı." };
    }

    const passwordMatch = await compare(password, user.password);

    if (!passwordMatch) {
      return { error: "E-posta veya şifre hatalı." };
    }

    const cookieStore = await cookies();
    cookieStore.set(
      COOKIE_NAME,
      JSON.stringify({ userId: user.id, name: user.name }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      },
    );
  } catch {
    return { error: "Bir hata oluştu. Lütfen tekrar deneyin." };
  }

  return { success: true };
}
