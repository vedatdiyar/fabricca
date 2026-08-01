import { eq } from "drizzle-orm";
import { db } from "@/db";
import { matrices, boxes, sources } from "@/db/schema";
import { DEFAULT_PARENT_BOXES } from "@/lib/box-constants";

/**
 * Fetches a source row together with its linked box and owning matrix.
 * Extracted so the full nested relation type can be derived for callers.
 *
 * @param resourceId - Target source ID.
 */
async function findSourceWithBox(resourceId: number) {
  return db.query.sources.findFirst({
    where: eq(sources.id, resourceId),
    with: { box: { with: { matrix: true } } },
  });
}

/** A source row including its linked box and owning matrix. */
type OwnedSource = NonNullable<Awaited<ReturnType<typeof findSourceWithBox>>>;

/**
 * Fetches a library source only if it belongs to the given user.
 * Ownership is verified through the chain: source → box → matrix → user.
 * Callers must check for the `error` branch before using the returned source.
 *
 * @param resourceId - Target source ID.
 * @param userId - The authenticated user's ID.
 * @returns The owned source (with its linked box and matrix) or an error message.
 */
export async function getOwnedSource(
  resourceId: number,
  userId: number,
): Promise<{ source: OwnedSource } | { error: string }> {
  const source = await findSourceWithBox(resourceId);

  if (!source) {
    return { error: "Eser bulunamadı." };
  }

  if (source.box.matrix.userId !== userId) {
    return {
      error: "Bu eser üzerinde işlem yapma yetkiniz bulunmamaktadır.",
    };
  }

  return { source };
}

/**
 * Ensures the user has a thesis matrix and at least the 4 default parent boxes.
 * Idempotent — returns the existing matrix/boxes when available, otherwise seeds defaults.
 *
 * @param userId - The authenticated user's ID
 * @returns The user's matrix and all box rows (parents and children)
 */
export async function ensureUserMatrixAndBoxes(userId: number) {
  const matrix = await db.query.matrices.findFirst({
    where: eq(matrices.userId, userId),
    with: { boxes: true },
  });

  if (matrix && matrix.boxes.length > 0) {
    return { matrix, boxes: matrix.boxes };
  }

  const targetMatrix =
    matrix ??
    (
      await db
        .insert(matrices)
        .values({
          userId,
          subjectProblem: "Akademik Araştırma ve Literatür İncelemesi",
          theoreticalFramework: "Kuramsal Temeller ve Metodolojik Yaklaşım",
          methodology: "Nitel ve Nicel Analiz Yöntemleri",
        })
        .returning()
    )[0];

  const newBoxes =
    !matrix || matrix.boxes.length === 0
      ? await db
          .insert(boxes)
          .values(
            DEFAULT_PARENT_BOXES.map((b) => ({
              matrixId: targetMatrix.id,
              ...b,
            })),
          )
          .returning()
      : [];

  return { matrix: targetMatrix, boxes: newBoxes };
}
