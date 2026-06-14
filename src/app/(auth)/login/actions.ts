"use server";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { compare } from "bcrypt-ts";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/proxy";
import { createFlowId, Logger } from "@/lib/logger";

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
  const flowId = createFlowId();
  const log = new Logger(flowId);

  if (!email || !password) {
    log.info("login_failed", {
      service: "auth",
      data: { reason: "Eksik bilgiler" },
    });
    return { error: "E-posta ve şifre gereklidir." };
  }

  try {
    log.info({ step: "find_user", status: "START", service: "db" });
    const t0 = performance.now();
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        password: users.password,
        onboardingCompleted: users.onboardingCompleted,
      })
      .from(users)
      .where(eq(users.email, email));
    log.info({ step: "find_user", status: "SUCCESS", metrics: { durationMs: performance.now() - t0 }, service: "db" });

    if (!user) {
      log.info("login_failed", {
        service: "auth",
        data: { reason: "Kullanıcı bulunamadı" },
      });
      return { error: "E-posta veya şifre hatalı." };
    }

    const passwordMatch = await compare(password, user.password);

    if (!passwordMatch) {
      log.info("login_failed", {
        service: "auth",
        data: { reason: "Şifre eşleşmedi" },
      });
      return { error: "E-posta veya şifre hatalı." };
    }

    const cookieStore = await cookies();
    cookieStore.set(
      COOKIE_NAME,
      JSON.stringify({
        userId: user.id,
        name: user.name,
        onboardingCompleted: user.onboardingCompleted,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      },
    );

    log.info("login_success", {
      service: "auth",
      data: { userId: user.id },
    });
  } catch {
    log.info("login_failed", {
      service: "auth",
      data: { reason: "Sunucu hatası" },
    });
    return { error: "Bir hata oluştu. Lütfen tekrar deneyin." };
  }

  return { success: true };
}

export type OnboardingStatusResult =
  | {
      onboardingCompleted: boolean;
      error?: never;
    }
  | { onboardingCompleted?: never; error: string };

/**
 * Mevcut oturumdaki kullanıcının onboarding tamamlanma durumunu sorgular.
 * Login sayfası tarafından, başarılı giriş sonrası yönlendirme
 * kararını vermek için kullanılır.
 *
 * @returns { onboardingCompleted: boolean } veya hata durumunda { error: string }
 */
export async function checkOnboardingStatus(): Promise<OnboardingStatusResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();

    if (!session) {
      log.info("flow_complete", {
        service: "auth",
        data: { reason: "Oturum bulunamadı" },
      });
      return { error: "Oturum bulunamadı." };
    }

    log.info({ step: "query_step", status: "START", service: "db" });
    const t0 = performance.now();
    const [user] = await db
      .select({ onboardingCompleted: users.onboardingCompleted })
      .from(users)
      .where(eq(users.id, session.userId));
    log.info({ step: "query_step", status: "SUCCESS", metrics: { durationMs: performance.now() - t0 }, service: "db" });

    return {
      onboardingCompleted: user?.onboardingCompleted ?? false,
    };
  } catch {
    log.info("login_failed", {
      service: "auth",
      data: { reason: "Onboarding durumu sorgulanamadı" },
    });
    return { error: "Onboarding durumu sorgulanırken bir hata oluştu." };
  }
}
