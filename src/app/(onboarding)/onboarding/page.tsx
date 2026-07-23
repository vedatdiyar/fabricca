import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  thesisMatrices,
  thesisPositioning,
  thesisBoxes,
  libraryResources,
} from "@/db/schema";
import { getProfile } from "@/lib/session";

/**
 * Onboarding root router page.
 * Finds the LAST successfully completed step and redirects there.
 * - Nothing completed yet → matrix (first step)
 * - Matrix exists, no positioning report → positioning
 * - Positioning exists, no boxes → boxes
 * - Boxes exist, literature review not completed → literature-review
 * - Fully completed → dashboard
 */
export default async function OnboardingPage() {
  const profile = await getProfile();

  if (profile.onboardingCompleted) {
    redirect("/dashboard");
  }

  // Step 1: Check matrix
  const [matrix] = await db
    .select({ id: thesisMatrices.id })
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, profile.id));

  if (!matrix) {
    redirect("/onboarding/matrix");
  }

  // Step 2: Check positioning report
  const [positioning] = await db
    .select({
      id: thesisPositioning.id,
      globalStatus: thesisPositioning.globalStatus,
    })
    .from(thesisPositioning)
    .where(eq(thesisPositioning.userId, profile.id));

  if (!positioning || !positioning.globalStatus) {
    redirect("/onboarding/positioning");
  }

  // Step 3: Check if boxes exist
  const [box] = await db
    .select({ id: thesisBoxes.id })
    .from(thesisBoxes)
    .where(eq(thesisBoxes.thesisMatrixId, matrix.id))
    .limit(1);

  if (!box) {
    redirect("/onboarding/boxes");
  }

  // Step 4: Check if literature review exists (library resources)
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
