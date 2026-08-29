"use server";

import { and, eq, ne } from "drizzle-orm";
import { db } from "@/core/db";
import {
  matrices,
  positioning,
  boxes,
  sources,
  outlines,
} from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { rethrowAsDatabaseError } from "@/lib/errors/db-error";

/**
 * Returns which onboarding steps have data for the current user.
 *
 * @returns A record mapping step keys to data presence, or null.
 */
export async function checkStepsDataAction(): Promise<Record<
  string,
  boolean
> | null> {
  try {
    const session = await getSession();
    if (!session) return null;

    const userId = session.userId;

    const [matrix] = await db
      .select({
        id: matrices.id,
        rawProposal: matrices.rawProposal,
        subjectProblem: matrices.subjectProblem,
      })
      .from(matrices)
      .where(eq(matrices.userId, userId));

    const hasProposal = Boolean(
      matrix?.rawProposal && matrix.rawProposal.trim().length >= 50,
    );
    const hasMatrix = Boolean(
      matrix &&
      matrix.subjectProblem &&
      matrix.subjectProblem.trim().length > 0,
    );

    let hasPositioning = false;
    let hasBoxes = false;
    let hasOutline = false;
    let hasLiterature = false;

    if (hasMatrix) {
      const [posResult, boxResult, outlineResult, litResult] =
        await Promise.all([
          db
            .select({
              id: positioning.id,
              globalStatus: positioning.globalStatus,
            })
            .from(positioning)
            .where(eq(positioning.userId, userId))
            .limit(1),
          db
            .select({ id: boxes.id })
            .from(boxes)
            .where(eq(boxes.matrixId, matrix.id))
            .limit(1),
          db
            .select({ id: outlines.id })
            .from(outlines)
            .where(eq(outlines.matrixId, matrix.id))
            .limit(1),
          db
            .select({ id: sources.id })
            .from(sources)
            .innerJoin(boxes, eq(sources.boxId, boxes.id))
            .where(
              and(
                eq(boxes.matrixId, matrix.id),
                ne(boxes.boxType, "RELATED_THESES"),
              ),
            )
            .limit(1),
        ]);

      hasPositioning = posResult.length > 0 && !!posResult[0].globalStatus;
      hasBoxes = boxResult.length > 0;
      hasOutline = outlineResult.length > 0;
      hasLiterature = litResult.length > 0;
    }

    return {
      proposal: hasProposal,
      matrix: hasMatrix,
      positioning: hasPositioning,
      boxes: hasBoxes,
      outline: hasOutline,
      "literature-review": hasLiterature,
    };
  } catch (err) {
    rethrowAsDatabaseError(err, "Failed to check onboarding step data.");
  }
}
