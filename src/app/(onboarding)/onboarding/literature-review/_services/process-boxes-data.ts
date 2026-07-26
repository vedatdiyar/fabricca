import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices } from "@/db/schema";

export interface LoadedMatrixData {
  id: number;
  subjectProblem: string;
  theoreticalFramework: string;
  analysisActors: string | null;
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
      id: thesisMatrices.id,
      subjectProblem: thesisMatrices.subjectProblem,
      theoreticalFramework: thesisMatrices.theoreticalFramework,
      analysisActors: thesisMatrices.analysisActors,
      primaryMaterial: thesisMatrices.primaryMaterial,
      methodology: thesisMatrices.methodology,
    })
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, userId));

  return { matrix };
}
