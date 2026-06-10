"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/proxy";
import { revalidatePath } from "next/cache";

export type OnboardingActionResult =
  | { success: true; error?: never }
  | { success?: never; error: string };

/**
 * Onboarding adımını tamamen "completed" olarak günceller.
 */
export async function completeOnboardingAction(): Promise<OnboardingActionResult> {
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    await db
      .update(users)
      .set({ onboardingStep: "completed" })
      .where(eq(users.id, session.userId));

    revalidatePath("/onboarding");
    return { success: true };
  } catch (err) {
    console.error("completeOnboardingAction failed:", err);
    return { error: "Onboarding tamamlanırken bir hata oluştu." };
  }
}
