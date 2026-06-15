import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, originalityReports, thesisBoxes } from "@/db/schema";
import { getProfile } from "@/proxy";

/**
 * Onboarding root router page.
 * Always redirects to the last completed step:
 * - No matrix → matrix form (first step)
 * - Matrix exists, no report → matrix (last completed = matrix)
 * - Report exists, no boxes → enrichment (last completed = enrichment)
 * - Boxes exist, not completed → boxes (last completed = boxes)
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
    redirect("/onboarding/matrix");
  }

  const [box] = await db
    .select({ id: thesisBoxes.id })
    .from(thesisBoxes)
    .where(eq(thesisBoxes.thesisMatrixId, matrix.id))
    .limit(1);

  if (!box) {
    redirect("/onboarding/enrichment");
  }

  redirect("/onboarding/boxes");
}
