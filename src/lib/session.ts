import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export const SESSION_COOKIE_NAME = "fabricca_session";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** User-facing error message shown when the session is not found. */
export const SESSION_ERROR_MSG =
  "Oturum bulunamadı. Lütfen tekrar giriş yapın.";

export type SessionUser = {
  userId: number;
  name: string;
  onboardingCompleted?: boolean;
};

export type SessionWithOnboarding = SessionUser & {
  onboardingCompleted: boolean;
};

declare const global: {
  __mockSession?: SessionUser | null;
} & typeof globalThis;

/**
 * Reads the session user from the session cookie; returns null when the cookie is invalid or missing.
 *
 * @returns The session user, or null when there is no valid session.
 */
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
 * Returns the session with the user's onboarding status. The database is always
 * treated as the source of truth; the cookie value is only used as a fallback
 * when the database query fails (avoids stale-cookie auth bypasses).
 *
 * @returns The session with onboarding status, or null when there is no valid session.
 */
export async function getSessionWithOnboarding(): Promise<SessionWithOnboarding | null> {
  const session = await getSession();

  if (!session) {
    return null;
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
 * Returns the authenticated user's profile; redirects to /login when there is no valid session or user.
 *
 * @returns The authenticated user's profile data.
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
