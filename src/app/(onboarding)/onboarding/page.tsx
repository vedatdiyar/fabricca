import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  thesisMatrices,
  originalityReports,
  thesisBoxes,
  libraryResources,
} from "@/db/schema";
import { getProfile } from "@/lib/session";

/**
 * Onboarding root router page.
 * Finds the LAST successfully completed step and redirects there.
 * Never auto-forwards the user to a step they haven't explicitly started.
 * - Nothing completed yet → matrix (first step)
 * - Matrix exists, no report → matrix
 * - Report exists, no boxes → risk
 * - Boxes exist, no literature → boxes
 * - Literature review not completed → literature-review
 * - Fully completed → dashboard
 */
export default async function OnboardingPage() {
  const profile = await getProfile();

  if (profile.onboardingCompleted) {
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
    redirect("/onboarding/matrix");
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

  // Check if literature review exists (library resources)
  const [lit] = await db
    .select({ id: libraryResources.id })
    .from(libraryResources)
    .innerJoin(thesisBoxes, eq(libraryResources.thesisBoxId, thesisBoxes.id))
    .where(eq(thesisBoxes.thesisMatrixId, matrix.id))
    .limit(1);

  if (!lit) {
    redirect("/onboarding/boxes");
  }

  redirect("/onboarding/literature-review");
}
