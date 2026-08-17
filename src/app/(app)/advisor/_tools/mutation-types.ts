/** Result payload returned by every mutation tool execution. */
export interface MutationToolResult {
  success: boolean;
  /** User-facing Turkish message shown for successful executions. */
  message?: string;
  /** User-facing Turkish error message shown when the execution fails. */
  error?: string;
  data?: unknown;
  previousState?: Record<string, unknown>;
}

/** A single mutation tool handler with execute and previous-state capture. */
export interface MutationToolHandler {
  execute(
    args: Record<string, unknown>,
    userId: number,
  ): Promise<MutationToolResult>;
  getPreviousState(
    args: Record<string, unknown>,
    userId: number,
  ): Promise<Record<string, unknown> | undefined>;
}

/**
 * Coerces a raw tool argument id (number or numeric string) into a number.
 *
 * @param value - The raw id argument.
 * @returns The numeric id, or 0 when not coercible.
 */
export function toNumericId(value: unknown): number {
  return typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number(value)
      : 0;
}
