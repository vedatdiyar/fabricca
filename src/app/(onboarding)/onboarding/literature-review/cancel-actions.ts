"use server";

import { DatabaseError } from "@/lib/errors/app-error";
import { getSession } from "@/lib/session";
import { setLiteratureCancelled, isLiteratureCancelled } from "./cancel-state";

/** Signals the running pipeline to stop, called from the client cancel callback. */
export async function setLiteratureCancelledAction(): Promise<void> {
  try {
    const session = await getSession();
    if (session) {
      setLiteratureCancelled(session.userId, true);
    }
  } catch (err) {
    throw new DatabaseError({
      cause: err,
      message: "Failed to set literature cancel flag.",
    });
  }
}

/** Resets the cancel flag before a fresh pipeline run. */
export async function resetLiteratureCancelledAction(): Promise<void> {
  try {
    const session = await getSession();
    if (session) {
      setLiteratureCancelled(session.userId, false);
    }
  } catch (err) {
    throw new DatabaseError({
      cause: err,
      message: "Failed to reset literature cancel flag.",
    });
  }
}

/**
 * Checks whether a cancellation has been requested for the given user.
 *
 * @param userId - The database ID of the user.
 * @returns True when cancellation is requested, false otherwise.
 */
export async function isLiteratureCancelledAction(
  userId: number,
): Promise<boolean> {
  return isLiteratureCancelled(userId);
}
