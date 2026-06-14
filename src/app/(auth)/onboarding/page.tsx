import { redirect } from "next/navigation";
import { getProfile } from "@/proxy";

/**
 * Onboarding root router page (Server Component).
 * Reads onboarding_step from DB and redirects to the appropriate sub-route.
 */
export default async function OnboardingPage() {
  const profile = await getProfile();

  switch (profile.onboarding_step) {
    case "thesis_matrix":
      redirect("/onboarding/matrix");
    case "thesis_matrix_enhanced":
      redirect("/onboarding/enrichment");
    case "originality_report":
      redirect("/onboarding/risk");
    case "originality_report_completed":
      redirect("/onboarding/boxes");
    case "completed":
      redirect("/dashboard");
    default:
      redirect("/onboarding/matrix");
  }
}
