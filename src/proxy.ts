import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export type SessionUser = {
  userId: number;
  name: string;
};

export type SessionWithOnboarding = SessionUser & {
  onboardingStep: string;
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
export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("fabricca_session")?.value;

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
      return parsed as SessionUser;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Oturum bilgisiyle birlikte kullanıcının onboarding adımını döndürür.
 * Eğer kullanıcı kaydı bulunamazsa onboardingStep varsayılan olarak
 * "thesis_matrix" kabul edilir.
 *
 * Kullanıldığı yerler:
 *  - (app)/layout.tsx (onboarding kontrolü)
 *  - (auth)/layout.tsx (onboarding yönlendirmesi)
 *
 * @returns SessionWithOnboarding nesnesi veya oturum yoksa null
 */
export async function getSessionWithOnboarding(): Promise<SessionWithOnboarding | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  try {
    const [user] = await db
      .select({ onboardingStep: users.onboardingStep })
      .from(users)
      .where(eq(users.id, session.userId));

    return {
      ...session,
      onboardingStep: user?.onboardingStep ?? "thesis_matrix",
    };
  } catch {
    return {
      ...session,
      onboardingStep: "thesis_matrix",
    };
  }
}
