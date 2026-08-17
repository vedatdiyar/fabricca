import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { matrices } from "@/core/db/schema";

export interface LoadedMatrixData {
  id: number;
  subjectProblem: string;
  theoreticalFramework: string;
  primaryMaterial: string | null;
  methodology: string;
}

/**
 * Loads the thesis matrix from the database.
 *
 * @param userId - The database ID of the user.
 * @returns The loaded thesis matrix or null when not found.
 */
export async function loadThesisMatrixAndBoxes(userId: number): Promise<{
  matrix: LoadedMatrixData | null;
}> {
  const [matrix] = await db
    .select({
      id: matrices.id,
      subjectProblem: matrices.subjectProblem,
      theoreticalFramework: matrices.theoreticalFramework,
      primaryMaterial: matrices.primaryMaterial,
      methodology: matrices.methodology,
    })
    .from(matrices)
    .where(eq(matrices.userId, userId));

  return { matrix };
}
