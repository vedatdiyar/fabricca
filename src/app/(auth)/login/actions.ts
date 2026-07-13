"use server";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { compare } from "bcrypt-ts";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  getSessionWithOnboarding,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  SESSION_ERROR_MSG,
} from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";

/* ---------- Validation Schema ---------- */

const LoginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi girin.").max(255),
  password: z.string().min(1, "Şifre gereklidir.").max(128, "Şifre çok uzun."),
});

/* ---------- Brute-Force Protection ---------- */

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

const attemptMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const record = attemptMap.get(email);

  if (!record || now - record.windowStart > LOGIN_WINDOW_MS) {
    attemptMap.set(email, { count: 1, windowStart: now });
    return true;
  }

  if (record.count >= LOGIN_MAX_ATTEMPTS) {
    return false;
  }

  record.count++;
  return true;
}

/* ---------- Result Types ---------- */

export type LoginResult =
  { success: true; error?: never } | { success?: never; error: string };

export type OnboardingStatusResult =
  | { onboardingCompleted: boolean; error?: never }
  | { onboardingCompleted?: never; error: string };

/* ---------- Server Actions ---------- */

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

  // 1. Zod validasyonu
  const parsed = LoginSchema.safeParse({ email, password });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Geçersiz giriş bilgileri.";
    log.info("login_failed", {
      service: "auth",
      data: { reason: "Validasyon hatası" },
    });
    return { error: msg };
  }

  // 2. Brute-force kontrolü
  if (!checkRateLimit(parsed.data.email)) {
    log.info("login_failed", {
      service: "auth",
      data: { reason: "Rate limit aşıldı" },
    });
    return {
      error:
        "Çok fazla başarısız giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.",
    };
  }

  try {
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        password: users.password,
        onboardingCompleted: users.onboardingCompleted,
      })
      .from(users)
      .where(eq(users.email, parsed.data.email));

    if (!user) {
      log.info("login_failed", {
        service: "auth",
        data: { reason: "Kullanıcı bulunamadı" },
      });
      return { error: "E-posta veya şifre hatalı." };
    }

    const passwordMatch = await compare(parsed.data.password, user.password);

    if (!passwordMatch) {
      log.info("login_failed", {
        service: "auth",
        data: { reason: "Şifre eşleşmedi" },
      });
      return { error: "E-posta veya şifre hatalı." };
    }

    const cookieStore = await cookies();
    cookieStore.set(
      SESSION_COOKIE_NAME,
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
        maxAge: SESSION_MAX_AGE_SECONDS,
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

/**
 * Mevcut oturumdaki kullanıcının onboarding tamamlanma durumunu sorgular.
 * DRY: getSessionWithOnboarding fonksiyonunu kullanır.
 *
 * @returns { onboardingCompleted: boolean } veya hata durumunda { error: string }
 */
export async function checkOnboardingStatus(): Promise<OnboardingStatusResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSessionWithOnboarding();

    if (!session) {
      log.info("flow_complete", {
        service: "auth",
        data: { reason: "Oturum bulunamadı" },
      });
      return { error: SESSION_ERROR_MSG };
    }

    return {
      onboardingCompleted: session.onboardingCompleted,
    };
  } catch {
    log.info("login_failed", {
      service: "auth",
      data: { reason: "Onboarding durumu sorgulanamadı" },
    });
    return { error: "Onboarding durumu sorgulanırken bir hata oluştu." };
  }
}
