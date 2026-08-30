import { and, eq, ne } from "drizzle-orm";
import { db } from "@/core/db";
import { boxes as boxRows } from "@/core/db/schema";

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

type ValidBox = {
  title: string;
  boxType:
    | "SUBJECT_PROBLEM"
    | "THEORETICAL_FRAMEWORK"
    | "METHODOLOGY"
    | "PRIMARY_MATERIAL";
  description?: string;
  parentId: number | null;
  semanticQuery: string | null;
  concepts?: string[];
};

/**
 * Inserts boxes in a transaction: deletes existing, inserts parents then children.
 *
 * @param tx - Drizzle transaction client.
 * @param validBoxes - Validated box payload.
 * @param thesisMatrixId - Thesis matrix ID.
 */
export async function insertBoxesTransaction(
  tx: TxClient,
  validBoxes: ValidBox[],
  thesisMatrixId: number,
): Promise<void> {
  await tx
    .delete(boxRows)
    .where(
      and(
        eq(boxRows.matrixId, thesisMatrixId),
        ne(boxRows.boxType, "RELATED_THESES"),
      ),
    );

  const parentFlatIndices: number[] = [];
  for (let i = 0; i < validBoxes.length; i++) {
    if (validBoxes[i].parentId === null) {
      parentFlatIndices.push(i);
    }
  }

  const parentValues = parentFlatIndices.map((i) => ({
    matrixId: thesisMatrixId,
    title: validBoxes[i].title,
    boxType: validBoxes[i].boxType,
    description: validBoxes[i].description || "",
    parentId: null,
    semanticQuery: null,
    concepts: validBoxes[i].concepts || [],
  }));

  let insertedParents: { id: number }[] = [];
  if (parentValues.length > 0) {
    insertedParents = await tx
      .insert(boxRows)
      .values(parentValues)
      .returning({ id: boxRows.id });
  }

  const dbParentIdMap = new Map<number, number>();
  for (let j = 0; j < parentFlatIndices.length; j++) {
    const dbId = insertedParents[j]?.id;
    if (dbId !== undefined) {
      dbParentIdMap.set(parentFlatIndices[j], dbId);
    }
  }

  const childValues: (typeof boxRows.$inferInsert)[] = [];
  for (let i = 0; i < validBoxes.length; i++) {
    const box = validBoxes[i];
    if (box.parentId === null) continue;
    const mappedParentId = dbParentIdMap.get(box.parentId) ?? null;
    childValues.push({
      matrixId: thesisMatrixId,
      title: box.title,
      boxType: box.boxType,
      description: box.description || "",
      parentId: mappedParentId,
      semanticQuery: box.semanticQuery || "",
      concepts: box.concepts ?? [],
    });
  }

  if (childValues.length > 0) {
    await tx.insert(boxRows).values(childValues);
  }
}
