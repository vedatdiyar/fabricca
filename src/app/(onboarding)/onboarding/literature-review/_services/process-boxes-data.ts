import { eq } from "drizzle-orm";
import { db } from "@/db";
import { matrices } from "@/db/schema";

export interface LoadedMatrixData {
  id: number;
  subjectProblem: string;
  theoreticalFramework: string;
  primaryMaterial: string | null;
  methodology: string;
}

/**
 * Loads the thesis matrix from the database.
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
