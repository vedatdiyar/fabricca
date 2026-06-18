import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, originalityReports, thesisBoxes } from "@/db/schema";
import { getProfile } from "@/proxy";

/**
 * Onboarding root router page.
 * Finds the LAST successfully completed step and redirects there.
 * Never auto-forwards the user to a step they haven't explicitly started.
 * - Nothing completed yet → matrix (first step)
 * - Matrix exists, no report → matrix (last completed)
 * - Report exists, no boxes → risk (last completed)
 * - Boxes exist → boxes (last completed)
 * - Fully completed → dashboard
 */
export default async function OnboardingPage() {
  const profile = await getProfile();

  if (profile.onboarding_completed) {
    redirect("/dashboard");
  }

  // Check matrix first
  const [matrix] = await db
    .select({ id: thesisMatrices.id })
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, profile.id));

  if (!matrix) {
    redirect("/onboarding/matrix");
  }

  // Check if report (risk analysis) exists
  const [report] = await db
    .select({ id: originalityReports.id })
    .from(originalityReports)
    .where(eq(originalityReports.userId, profile.id));

  if (!report) {
    redirect("/onboarding/enrichment");
  }

  // Check if boxes exist
  const [box] = await db
    .select({ id: thesisBoxes.id })
    .from(thesisBoxes)
    .where(eq(thesisBoxes.thesisMatrixId, matrix.id))
    .limit(1);

  if (!box) {
    redirect("/onboarding/risk");
  }

  redirect("/onboarding/boxes");
}
