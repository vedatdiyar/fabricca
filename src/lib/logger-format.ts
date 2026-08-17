export const C_RESET = "\x1b[0m";
export const C_GREEN = "\x1b[32m";
export const C_RED = "\x1b[31m";
export const C_YELLOW = "\x1b[33m";

/**
 * Derives START, SUCCESS, or FAILED status from an event name's suffix.
 *
 * @param event - Event name possibly ending with a status suffix.
 * @returns The derived status, or empty string when none matches.
 */
export function deriveStatus(event: string): string {
  if (event.endsWith("_start")) return "START";
  if (event.endsWith("_success")) return "SUCCESS";
  if (
    event.endsWith("_failed") ||
    event.endsWith("_filtered") ||
    event.endsWith("_empty")
  )
    return "FAILED";
  return "";
}

/**
 * Returns the icon corresponding to a status.
 *
 * @param s - Status string (START, SUCCESS, FAILED, or RETRY).
 * @returns The matching icon.
 */
export function statusIcon(s: string): string {
  return s === "START"
    ? "⏳"
    : s === "SUCCESS"
      ? "✓"
      : s === "FAILED"
        ? "✖"
        : s === "RETRY"
          ? "↻"
          : "•";
}

/**
 * Returns the ANSI color code for a status.
 *
 * @param s - Status string.
 * @returns The matching ANSI color code.
 */
export function statusColor(s: string): string {
  if (s === "SUCCESS") return C_GREEN;
  if (s === "FAILED") return C_RED;
  if (s === "START" || s === "RETRY") return C_YELLOW;
  return "";
}

/**
 * Formats a millisecond duration compactly ("497ms" or "1.5s").
 *
 * @param ms - Duration in milliseconds.
 * @returns Compact duration string.
 */
export function formatDuration(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe < 1000) return `${Math.round(safe)}ms`;
  const sec = safe / 1000;
  if (Number.isInteger(sec)) return `${sec}s`;
  return `${sec.toFixed(1)}s`;
}

/**
 * Converts an unknown error value into a short readable message.
 *
 * @param error - Error value of any type.
 * @returns Short readable message.
 */
export function extractReason(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
