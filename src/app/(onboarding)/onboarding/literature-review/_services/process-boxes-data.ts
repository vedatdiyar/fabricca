import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices } from "@/db/schema";

export interface LoadedMatrixData {
  id: number;
  researchCore: string;
  context: string;
  framework: string;
  mainClaim: string;
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
      context: thesisMatrices.context,
      framework: thesisMatrices.framework,
      mainClaim: thesisMatrices.mainClaim,
    })
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, userId));

  return { matrix };
}
