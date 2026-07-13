import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
/** Session cookie adı (Next.js cookie store key) */
export const SESSION_COOKIE_NAME = "fabricca_session";

/** Session cookie maksimum yaşam süresi (saniye) — 7 gün */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** Error message shown when the session is not found. */
export const SESSION_ERROR_MSG = "Session not found. Please log in again.";

export type SessionUser = {
  userId: number;
  name: string;
  onboardingCompleted?: boolean;
};

export type SessionWithOnboarding = SessionUser & {
  onboardingCompleted: boolean;
};

/**
 * Session cookie'sinden kullanıcı bilgisini okur.
 * Geçersiz veya eksik cookie durumunda null döner.
 *
 * Kullanıldığı yerler:
 *  - (app)/layout.tsx (korumalı sayfalar)
 *  - (auth)/layout.tsx (giriş/onboarding sayfaları)
 *
 * @returns SessionUser nesnesi veya null
 */
declare const global: {
  __mockSession?: SessionUser | null;
} & typeof globalThis;

export async function getSession(): Promise<SessionUser | null> {
  if (typeof global !== "undefined" && global.__mockSession) {
    return global.__mockSession;
  }
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "userId" in parsed &&
      "name" in parsed &&
      typeof (parsed as Record<string, unknown>).userId === "number" &&
      typeof (parsed as Record<string, unknown>).name === "string"
    ) {
      const data = parsed as {
        userId: number;
        name: string;
        onboardingCompleted?: unknown;
      };
      const sessionUser: SessionUser = {
        userId: data.userId,
        name: data.name,
      };
      if (
        "onboardingCompleted" in data &&
        typeof data.onboardingCompleted === "boolean"
      ) {
        sessionUser.onboardingCompleted = data.onboardingCompleted;
      }
      return sessionUser;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Returns the session together with the user's onboarding status.
 * If the user record is not found, onboardingCompleted defaults to false.
 *
 * Used by:
 *  - (app)/layout.tsx (onboarding guard)
 *  - (auth)/layout.tsx (onboarding redirect)
 *
 * @returns SessionWithOnboarding object or null if no session
 */
export async function getSessionWithOnboarding(): Promise<SessionWithOnboarding | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  if (session.onboardingCompleted) {
    return {
      ...session,
      onboardingCompleted: true,
    };
  }

  try {
    const [user] = await db
      .select({ onboardingCompleted: users.onboardingCompleted })
      .from(users)
      .where(eq(users.id, session.userId));

    return {
      ...session,
      onboardingCompleted: user?.onboardingCompleted ?? false,
    };
  } catch {
    return {
      ...session,
      onboardingCompleted: session.onboardingCompleted ?? false,
    };
  }
}

/**
 * Returns the authenticated user's profile information (including onboarding status).
 * Redirects to /login if there is no valid session or the user is not found.
 *
 * @returns User profile object
 */
export async function getProfile() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      onboardingCompleted: users.onboardingCompleted,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, session.userId));

  if (!user) {
    redirect("/login");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    onboardingCompleted: user.onboardingCompleted,
    createdAt: user.createdAt,
  };
}
