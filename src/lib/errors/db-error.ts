import { DatabaseError } from "./app-error";

/**
 * Rethrows an already-normalized DatabaseError unchanged, or wraps any other thrown value into a DatabaseError.
 *
 * @param err - The thrown value to normalize.
 * @param message - Internal technical message for the wrapped error.
 * @param technicalDetails - Optional diagnostic context for the wrapped error.
 */
export function rethrowAsDatabaseError(
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
