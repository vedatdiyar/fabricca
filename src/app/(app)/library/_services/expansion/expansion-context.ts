import { db } from "@/core/db";
import { boxes, matrices, sources } from "@/core/db/schema";
import { eq, inArray } from "drizzle-orm";

/**
 * Fetches every source belonging to the given thesis matrix, so the dedup pass
 * can catch works already present in the library under a different box/title.
 *
 * @param matrixId - The user's thesis matrix ID.
 * @returns All user sources across the matrix boxes.
 */
export async function fetchUserLibraryForDedup(
  matrixId: number,
): Promise<{ title: string; doi: string | null; authors: string[] | null }[]> {
  const userBoxes = await db
    .select({ id: boxes.id })
    .from(boxes)
    .where(eq(boxes.matrixId, matrixId));

  const userBoxIds = userBoxes.map((b) => b.id);
  if (userBoxIds.length === 0) return [];

  return db
    .select({
      title: sources.title,
      doi: sources.doi,
      authors: sources.authors,
    })
    .from(sources)
    .where(inArray(sources.boxId, userBoxIds));
}

/**
 * Builds the thesis context used as the rerank query and LLM selection prompt:
 * the box title/description joined with the matrix subject problem and
 * theoretical framework.
 *
 * @param matrixId - The user's thesis matrix ID (may be null).
 * @param boxId - The target sub-box ID.
 * @returns The combined context string.
 */
export async function buildThesisContext(
  matrixId: number | null,
  boxId: number,
): Promise<string> {
  let thesisContext = "";
  if (matrixId) {
    const [matrixRow] = await db
      .select({
        subjectProblem: matrices.subjectProblem,
        theoreticalFramework: matrices.theoreticalFramework,
      })
      .from(matrices)
      .where(eq(matrices.id, matrixId));
    if (matrixRow) {
      thesisContext = `${matrixRow.subjectProblem}. ${matrixRow.theoreticalFramework}`;
    }
  }

  const [boxDetail] = await db
    .select({ title: boxes.title, description: boxes.description })
    .from(boxes)
    .where(eq(boxes.id, boxId));

  if (boxDetail) {
    thesisContext =
      `${boxDetail.title}. ${boxDetail.description ?? ""}. ${thesisContext}`.trim();
  }

  return thesisContext;
}
