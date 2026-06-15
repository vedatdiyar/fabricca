import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, originalityReports, thesisBoxes } from "@/db/schema";
import { getProfile } from "@/proxy";

/**
 * Onboarding root router page.
 * Redirects to the last completed step:
 * - No matrix → matrix form
 * - Matrix exists, no report → enrichment review
 * - Report exists, no boxes → risk report
 * - Boxes exist, not completed → literature review
 * - Completed → dashboard
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
    redirect("/onboarding/enrichment");
  }

  const [box] = await db
    .select({ id: thesisBoxes.id })
    .from(thesisBoxes)
    .where(eq(thesisBoxes.thesisMatrixId, matrix.id))
    .limit(1);

  if (!box) {
    redirect("/onboarding/risk");
  }

  redirect("/onboarding/literature-review");
}
