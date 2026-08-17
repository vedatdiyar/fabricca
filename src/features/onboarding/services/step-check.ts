"use server";

import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { matrices, positioning, boxes, sources, outlines } from "@/db/schema";
import { getSession } from "@/lib/session";
import { DatabaseError } from "@/lib/errors/app-error";

/**
 * Rethrows an already-normalized DatabaseError unchanged, or wraps any other
 * thrown value into a DatabaseError so downstream callers stop the flow.
 *
 * @param err - The thrown value to normalize.
 * @param message - Internal technical message for the wrapped error.
 * @param technicalDetails - Optional diagnostic context for the wrapped error.
 */
function rethrowAsDatabaseError(
  err: unknown,
  message: string,
  technicalDetails?: Record<string, unknown>,
): never {
  if (err instanceof DatabaseError) throw err;
  throw new DatabaseError({
    cause: err,
    message,
    technicalDetails: technicalDetails ?? {
      cause:
        err instanceof Error
          ? err.message
          : err === undefined
            ? "undefined"
            : String(err),
    },
  });
}

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
      .select({ id: matrices.id })
      .from(matrices)
      .where(eq(matrices.userId, userId));

    const hasMatrix = !!matrix;

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
