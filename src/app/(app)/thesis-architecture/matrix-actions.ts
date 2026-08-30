"use server";

import { db } from "@/core/db";
import { matrices } from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { handleActionError } from "@/lib/errors/handle-error";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Updates the user's living thesis matrix pillars post-onboarding.
 */
export async function updateMatrixAction(data: {
  subjectProblem?: string;
  theoreticalFramework?: string;
  primaryMaterial?: string;
  methodology?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Oturum bulunamadı." };

    const userMatrix = await db.query.matrices.findFirst({
      where: eq(matrices.userId, session.userId),
    });

    if (!userMatrix)
      return { success: false, error: "Tez matrisi bulunamadı." };

    const updateData: Partial<typeof matrices.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (typeof data.subjectProblem === "string")
      updateData.subjectProblem = data.subjectProblem;
    if (typeof data.theoreticalFramework === "string")
      updateData.theoreticalFramework = data.theoreticalFramework;
    if (typeof data.primaryMaterial === "string")
      updateData.primaryMaterial = data.primaryMaterial;
    if (typeof data.methodology === "string")
      updateData.methodology = data.methodology;

    await db
      .update(matrices)
      .set(updateData)
      .where(eq(matrices.id, userMatrix.id));

    revalidatePath("/thesis-architecture");
    return { success: true };
  } catch (err) {
    return handleActionError(err);
  }
}
