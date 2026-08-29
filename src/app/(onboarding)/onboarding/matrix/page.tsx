import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";

/**
 * Onboarding Step 2: 4-Quadrant Academic Thesis Matrix review, editing, and confirmation studio.
 *
 * @returns The rendered matrix onboarding page.
 */
export default async function OnboardingMatrixPage() {
  const profile = await getProfile();

  if (profile.onboardingCompleted) {
    redirect("/dashboard");
  }

  redirect("/onboarding/positioning");
}
