import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { matrices, positioning, boxes, sources } from "@/db/schema";
import { getProfile } from "@/lib/session";

/**
 * Redirects the user to the last completed onboarding step.
 */
export default async function OnboardingPage() {
  const profile = await getProfile();

  if (profile.onboardingCompleted) {
    redirect("/dashboard");
  }

  const [matrix] = await db
    .select({ id: matrices.id })
    .from(matrices)
    .where(eq(matrices.userId, profile.id));

  if (!matrix) {
    redirect("/onboarding/matrix");
  }

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

  const [box] = await db
    .select({ id: boxes.id })
    .from(boxes)
    .where(eq(boxes.matrixId, matrix.id))
    .limit(1);

  if (!box) {
    redirect("/onboarding/boxes");
  }

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
