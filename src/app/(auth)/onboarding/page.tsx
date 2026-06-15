import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, originalityReports } from "@/db/schema";
import { getProfile } from "@/proxy";

/**
 * Onboarding root router page (Server Component).
 * If the user has existing onboarding data in the DB, skips directly to
 * the literature-review step. Otherwise starts from the matrix form.
 */
export default async function OnboardingPage() {
  const profile = await getProfile();

  if (profile.onboarding_completed) {
    redirect("/dashboard");
  }

  const [matrix] = await db
    .select({ id: thesisMatrices.id })
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, profile.id));

  if (!matrix) {
    redirect("/onboarding/matrix");
  }

  const [report] = await db
    .select({ id: originalityReports.id })
    .from(originalityReports)
    .where(eq(originalityReports.userId, profile.id));

  if (!report) {
    redirect("/onboarding/matrix");
  }

  redirect("/onboarding/literature-review");
}
