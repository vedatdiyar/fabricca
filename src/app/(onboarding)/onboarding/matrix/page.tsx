import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";

/**
 * Legacy matrix onboarding route — redirects directly to positioning step.
 *
 * @returns Server-side redirect to positioning.
 */
export default async function OnboardingMatrixPage() {
  const profile = await getProfile();

  if (profile.onboardingCompleted) {
    redirect("/dashboard");
  }

  redirect("/onboarding/positioning");
}
