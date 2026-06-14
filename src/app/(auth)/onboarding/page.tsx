import { redirect } from "next/navigation";
import { getProfile } from "@/proxy";

/**
 * Onboarding root router page (Server Component).
 * Reads onboarding_step from DB and redirects to the appropriate sub-route.
 */
export default async function OnboardingPage() {
  const profile = await getProfile();

  if (profile.onboarding_completed) {
    redirect("/dashboard");
  }

  redirect("/onboarding/matrix");
}
