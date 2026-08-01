import { eq } from "drizzle-orm";
import { db } from "@/db";
import { matrices, boxes } from "@/db/schema";
import type { ThesisBoxType } from "../_types/types";

/** Helper to provide default titles for thesis box types */
export function getBoxDefaultTitle(boxType: Exclude<ThesisBoxType, "ALL">) {
  switch (boxType) {
    case "THEORETICAL_FRAMEWORK":
      return "Kuramsal Çerçeve";
    case "METHODOLOGY":
      return "Metodoloji";
    case "SUBJECT_PROBLEM":
      return "Konu ve Problem";
    case "PRIMARY_MATERIAL":
      return "Birincil Malzeme";
  }
}

/** Default parent box definitions for users without a completed onboarding. */
const DEFAULT_PARENT_BOXES: {
  boxType: Exclude<ThesisBoxType, "ALL">;
  title: string;
}[] = [
  { boxType: "SUBJECT_PROBLEM", title: "Konu ve Problem" },
  { boxType: "THEORETICAL_FRAMEWORK", title: "Kuramsal Çerçeve" },
  { boxType: "PRIMARY_MATERIAL", title: "Birincil Malzeme" },
  { boxType: "METHODOLOGY", title: "Metodoloji" },
];

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
    matrix && matrix.boxes.length === 0
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
