import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices } from "@/db/schema";

export interface LoadedMatrixData {
  id: number;
  researchCore: string;
  framework: string;
  analysisActors: string;
  methodology: string;
  researchScope: string;
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
      researchCore: thesisMatrices.researchCore,
      framework: thesisMatrices.framework,
      analysisActors: thesisMatrices.analysisActors,
      methodology: thesisMatrices.methodology,
      researchScope: thesisMatrices.researchScope,
    })
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, userId));

  return { matrix };
}
