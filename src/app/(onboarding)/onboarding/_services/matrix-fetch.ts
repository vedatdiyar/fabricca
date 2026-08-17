import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/core/db";
import { matrices } from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { CACHE_TAGS } from "@/lib/cache-tags";
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
 * Cached DB query returning the user's thesis matrix (userId-keyed).
 *
 * @param userId - The id of the user to load the matrix for.
 * @returns The user's thesis matrix or null.
 */
export async function getCachedThesisMatrix(userId: number) {
  "use cache";
  cacheTag(CACHE_TAGS.thesisMatrix);
  cacheLife("minutes");

  try {
    const [matrix] = await db
      .select()
      .from(matrices)
      .where(eq(matrices.userId, userId));
    return matrix ?? null;
  } catch (err) {
    rethrowAsDatabaseError(err, "Failed to load cached thesis matrix.", {
      userId,
    });
  }
}

/**
 * Returns the current user's thesis matrix or null.
 *
 * @returns The current user's thesis matrix or null.
 */
export async function fetchThesisMatrix() {
  try {
    const session = await getSession();
    if (!session) return null;
    return getCachedThesisMatrix(session.userId);
  } catch (err) {
    rethrowAsDatabaseError(err, "Failed to fetch thesis matrix.");
  }
}

/**
 * Fetches the thesis matrix directly from the DB, bypassing the cache.
 *
 * @returns The current user's thesis matrix or null.
 */
export async function fetchThesisMatrixFresh() {
  try {
    const session = await getSession();
    if (!session) return null;

    const [matrix] = await db
      .select()
      .from(matrices)
      .where(eq(matrices.userId, session.userId));
    return matrix ?? null;
  } catch (err) {
    rethrowAsDatabaseError(err, "Failed to fetch fresh thesis matrix.");
  }
}
