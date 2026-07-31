import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { matrices, positioning, boxes, sources } from "@/db/schema";
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
    .select({ id: matrices.id })
    .from(matrices)
    .where(eq(matrices.userId, profile.id));

  if (!matrix) {
    redirect("/onboarding/matrix");
  }

  // Step 2: Check positioning report
  const [positioningRow] = await db
    .select({
      id: positioning.id,
      globalStatus: positioning.globalStatus,
    })
    .from(positioning)
    .where(eq(positioning.userId, profile.id));

  if (!positioningRow || !positioningRow.globalStatus) {
    redirect("/onboarding/positioning");
  }

  // Step 3: Check if boxes exist
  const [box] = await db
    .select({ id: boxes.id })
    .from(boxes)
    .where(eq(boxes.matrixId, matrix.id))
    .limit(1);

  if (!box) {
    redirect("/onboarding/boxes");
  }

  // Step 4: Check if literature review exists (library resources)
  const [lit] = await db
    .select({ id: sources.id })
    .from(sources)
    .innerJoin(boxes, eq(sources.boxId, boxes.id))
    .where(eq(boxes.matrixId, matrix.id))
    .limit(1);

  if (!lit) {
    redirect("/onboarding/boxes");
  }

  redirect("/onboarding/literature-review");
}
