const _cancelFlags = new Map<number, boolean>();

/**
 * Sets the cancellation status for a user's running literature review pipeline.
 *
 * @param userId - The database ID of the user.
 * @param value - Boolean flag indicating cancellation status.
 */
export function setLiteratureCancelled(userId: number, value: boolean): void {
  _cancelFlags.set(userId, value);
}

/**
 * Synchronously checks whether a cancellation has been requested for the given user.
 *
 * @param userId - The database ID of the user.
 * @returns True when cancellation is requested, false otherwise.
 */
export function isLiteratureCancelled(userId: number): boolean {
  return _cancelFlags.get(userId) ?? false;
}
