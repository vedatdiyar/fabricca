export const C_RESET = "\x1b[0m";
export const C_DIM = "\x1b[90m";
export const C_BOLD = "\x1b[1m";
export const C_GREEN = "\x1b[32m";
export const C_RED = "\x1b[31m";
export const C_YELLOW = "\x1b[33m";
export const C_CYAN = "\x1b[36m";
export const C_MAGENTA = "\x1b[35m";
export const C_BLUE = "\x1b[34m";
export const C_WHITE = "\x1b[37m";

/**
 * Derives START, SUCCESS, or FAILED status from an event name's suffix.
 *
 * @param event - Event name possibly ending with a status suffix.
 * @returns The derived status, or empty string when none matches.
 */
export function deriveStatus(event: string): string {
  if (event.endsWith("_start")) return "START";
  if (event.endsWith("_success")) return "SUCCESS";
  if (event.endsWith("_retry")) return "RETRY";
  if (
    event.endsWith("_failed") ||
    event.endsWith("_filtered") ||
    event.endsWith("_empty")
  ) {
    return "FAILED";
  }
  return "";
}

/**
 * Returns the icon corresponding to a status.
 *
 * @param s - Status string (START, SUCCESS, FAILED, RETRY, or TOTAL).
 * @returns The matching icon.
 */
export function statusIcon(s: string): string {
  if (s === "START") return "⏳";
  if (s === "SUCCESS") return "✓";
  if (s === "FAILED") return "✖";
  if (s === "RETRY") return "↻";
  if (s === "TOTAL" || s === "FINISH") return "🏁";
  return "•";
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
  if (s === "TOTAL" || s === "FINISH") return C_MAGENTA;
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
 * Returns current timestamp in dim brackets "[HH:MM:SS]".
 *
 * @param date - Optional date instance (defaults to now).
 * @returns Formatted time tag string.
 */
export function formatTimeTag(date = new Date()): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  const s = date.getSeconds().toString().padStart(2, "0");
  return `${C_DIM}[${h}:${m}:${s}]${C_RESET}`;
}

const DEFAULT_CONTENT_WIDTH = 38;

/**
 * Generates an aligned leader line ("Left Text ────────── Right Text")
 * by measuring visible characters without ANSI escape codes.
 *
 * @param leftText - The text on the left side of the separator.
 * @param rightText - The text on the right side of the separator.
 * @param targetWidth - Total target visible character width.
 * @returns Formatted string with leader line.
 */
export function formatLeaderLine(
  leftText: string,
  rightText: string,
  targetWidth = DEFAULT_CONTENT_WIDTH,
): string {
  const cleanLeft = leftText.replace(/\x1b\[[0-9;]*m/g, "");
  const cleanRight = rightText.replace(/\x1b\[[0-9;]*m/g, "");
  const usedLen = cleanLeft.length + cleanRight.length;
  const dashCount = Math.max(3, targetWidth - usedLen - 2);
  const leader = `${C_DIM}${"─".repeat(dashCount)}${C_RESET}`;
  return `${leftText} ${leader} ${rightText}`;
}

export interface PipelineHeaderOptions {
  module: string;
  name: string;
  timestamp?: Date;
}

/**
 * Formats a pipeline starting header banner (e.g. "[02:22:48] ▶ ONBOARDING / PROPOSAL_AUDIT").
 *
 * @param options - Header configuration options.
 * @returns Formatted pipeline header string.
 */
export function formatPipelineHeader(options: PipelineHeaderOptions): string {
  const timeTag = formatTimeTag(options.timestamp);
  const title = `${options.module.toUpperCase()} / ${options.name.toUpperCase()}`;
  return `${timeTag} ${C_CYAN}${C_BOLD}▶ ${title}${C_RESET}`;
}

export interface StageLineOptions {
  stageIndex?: number;
  stageTotal?: number;
  stageKey?: string;
  description: string;
  durationMs?: number;
  backoffMs?: number;
  status?: "SUCCESS" | "FAILED" | "RETRY" | "START";
  isSubStep?: boolean;
  isStageTotal?: boolean;
  error?: unknown;
}

/**
 * Formats a badge-aligned stage or sub-step log line.
 * E.g. "  [1/4] DECOMPOSE  │ Gemini Flash ──────── 2.2s"
 * E.g. "                   │ Exa (x2) ──────────── 267ms"
 * E.g. "                   │ ∑ Stage Total ─────── 5.5s"
 *
 * @param options - Stage configuration options.
 * @returns Formatted stage line string.
 */
export function formatStageLine(options: StageLineOptions): string {
  const BADGE_WIDTH = 18;
  const status = options.status ?? "SUCCESS";

  let badgeStr = "";
  if (options.isSubStep || options.stageIndex === undefined) {
    badgeStr = "".padEnd(BADGE_WIDTH, " ");
  } else {
    const rawBadge = `[${options.stageIndex}/${options.stageTotal ?? options.stageIndex}] ${(options.stageKey ?? "").toUpperCase()}`;
    const padded = rawBadge.padEnd(BADGE_WIDTH, " ");
    badgeStr = `${C_YELLOW}${padded}${C_RESET}`;
  }

  const sep = `${C_DIM}│${C_RESET}`;

  let rightPart = "";
  if (status === "RETRY") {
    const dur = options.backoffMs ? formatDuration(options.backoffMs) : "";
    rightPart = `${C_YELLOW}↻ ${dur}${C_RESET}`.trim();
  } else if (status === "FAILED") {
    const dur =
      options.durationMs !== undefined
        ? ` (${formatDuration(options.durationMs)})`
        : "";
    rightPart = `${C_RED}✖ Failed${dur}${C_RESET}`;
  } else {
    const dur =
      options.durationMs !== undefined
        ? formatDuration(options.durationMs)
        : "";
    rightPart = `${C_GREEN}${dur}${C_RESET}`;
  }

  const rawDescription = options.isStageTotal
    ? `${C_CYAN}∑${C_RESET} ${options.description}`
    : options.description;

  const content = formatLeaderLine(rawDescription, rightPart, 46);
  const mainLine = `  ${badgeStr} ${sep} ${content}`;

  if (status === "FAILED" && options.error != null) {
    const cleanReason = extractReason(options.error);
    const reasonIndent = "".padEnd(BADGE_WIDTH, " ");
    const reasonLine = `\n  ${reasonIndent} ${sep}   ${C_DIM}↳ reason: ${cleanReason}${C_RESET}`;
    return `${mainLine}${reasonLine}`;
  }

  return mainLine;
}

export interface PipelineFinishOptions {
  completedStages: number;
  totalStages: number;
  durationMs: number;
  status?: "SUCCESS" | "FAILED";
  error?: unknown;
}

/**
 * Formats a pipeline completion or failure summary line.
 * E.g. "🏁 Completed (4/4 stages) in 29.6s" or "✔ Done in 9.8s"
 *
 * @param options - Pipeline finish options.
 * @returns Formatted completion string.
 */
export function formatPipelineFinish(options: PipelineFinishOptions): string {
  const dur = formatDuration(options.durationMs);
  if (options.status === "FAILED") {
    const reason = options.error
      ? `\n  ${C_DIM}↳ reason: ${extractReason(options.error)}${C_RESET}`
      : "";
    return `${C_RED}${C_BOLD}✖ Pipeline failed at stage [${options.completedStages}/${options.totalStages}] in ${dur}${C_RESET}${reason}`;
  }
  return `${C_GREEN}${C_BOLD}🏁 Completed (${options.completedStages}/${options.totalStages} stages) in ${dur}${C_RESET}`;
}

export interface SingleLineLogOptions {
  status: "SUCCESS" | "FAILED" | "RETRY" | "TOTAL" | "START";
  service?: string;
  event: string;
  summary?: string;
  durationMs?: number;
  backoffMs?: number;
}

/**
 * Formats a clean single-line terminal log output for non-pipeline logs.
 *
 * @param options - Log line components.
 * @returns Formatted single-line string.
 */
export function formatLogLine(options: SingleLineLogOptions): string {
  const timeTag = formatTimeTag();
  const icon = statusIcon(options.status);
  const color = statusColor(options.status);
  const iconPart = `${color}${icon}${C_RESET}`;

  const serviceTag = options.service
    ? `${C_CYAN}[${options.service}]${C_RESET} `
    : "";

  let cleanSummary = options.summary;
  if (cleanSummary && cleanSummary.length > 55) {
    cleanSummary = `${cleanSummary.slice(0, 52)}...`;
  }

  const annotation = cleanSummary
    ? ` ${C_DIM}${cleanSummary}${C_RESET}`
    : "";

  let rightPart = "";
  if (options.durationMs !== undefined && options.durationMs !== null) {
    rightPart = `${color}${formatDuration(options.durationMs)}${C_RESET}`;
  } else if (options.backoffMs !== undefined && options.backoffMs !== null) {
    rightPart = `${C_YELLOW}backoff ${formatDuration(options.backoffMs)}${C_RESET}`;
  }

  const leftPart = `${serviceTag}${options.event}${annotation}`;
  const content = rightPart
    ? formatLeaderLine(leftPart, rightPart, 45)
    : leftPart;

  return `${timeTag} ${iconPart} ${content}`;
}

/**
 * Converts an unknown error value into a clean, human-readable single-line message.
 * Strips raw Google RPC JSON dumps, URL links, and massive stack payloads.
 *
 * @param error - Error value of any type.
 * @returns Clean readable single-line message.
 */
export function extractReason(error: unknown): string {
  if (!error) return "Unknown error";

  let raw = "";
  if (error instanceof Error) {
    raw = error.message;
  } else if (typeof error === "string") {
    raw = error;
  } else if (typeof error === "object") {
    try {
      raw = JSON.stringify(error);
    } catch {
      raw = String(error);
    }
  }

  // Check if raw is a JSON string containing an API error structure
  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const parsed = JSON.parse(raw);
      const apiErr = parsed?.error ?? parsed;
      if (apiErr && typeof apiErr === "object") {
        const code = apiErr.code ?? apiErr.status;
        const msg = typeof apiErr.message === "string" ? apiErr.message : "";

        if (
          code === 429 ||
          apiErr.status === "RESOURCE_EXHAUSTED" ||
          msg.includes("Quota exceeded") ||
          msg.includes("RESOURCE_EXHAUSTED")
        ) {
          const retryMatch = msg.match(
            /(?:retry in|retryDelay|retry after)\s+([\d.]+)\s*s/i,
          );
          const retrySec = retryMatch
            ? `${Math.round(parseFloat(retryMatch[1]))}s`
            : "";
          const metricMatch = msg.match(/limit:\s*(\d+)/i);
          const limitStr = metricMatch ? `${metricMatch[1]} RPM` : "15 RPM";
          return `Gemini rate limit exceeded (429 ${limitStr}${retrySec ? `, retry after ${retrySec}` : ""})`;
        }

        if (
          code === 503 ||
          apiErr.status === "UNAVAILABLE" ||
          msg.includes("503") ||
          msg.includes("high demand")
        ) {
          return "Gemini service unavailable (503 high demand)";
        }

        if (msg) {
          const cleanMsg = msg
            .replace(/https?:\/\/[^\s]+/g, "")
            .replace(/\* Quota exceeded for metric: [^\n]+/g, "")
            .replace(/For more information on this error[^\n]+/g, "")
            .replace(/To monitor your current usage[^\n]+/g, "")
            .replace(/\s+/g, " ")
            .trim();
          if (cleanMsg.length > 0) {
            return cleanMsg.length > 90
              ? `${cleanMsg.slice(0, 87)}...`
              : cleanMsg;
          }
        }
      }
    } catch {
      // not valid json
    }
  }

  // If raw string has 429 quota message
  if (
    raw.includes("RESOURCE_EXHAUSTED") ||
    raw.includes("Quota exceeded") ||
    raw.includes("429")
  ) {
    const retryMatch = raw.match(
      /(?:retry in|retryDelay|retry after)\s+([\d.]+)\s*s/i,
    );
    const retrySec = retryMatch
      ? `${Math.round(parseFloat(retryMatch[1]))}s`
      : "";
    const metricMatch = raw.match(/limit:\s*(\d+)/i);
    const limitStr = metricMatch ? `${metricMatch[1]} RPM` : "15 RPM";
    return `Gemini rate limit exceeded (429 ${limitStr}${retrySec ? `, retry after ${retrySec}` : ""})`;
  }

  if (
    raw.includes("503") ||
    raw.includes("high demand") ||
    raw.includes("UNAVAILABLE")
  ) {
    return "Gemini service unavailable (503 high demand)";
  }

  // Clean URLs and excessive whitespace
  const sanitized = raw
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/\{"error":\{.*\}\}/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (sanitized.length > 90) {
    return `${sanitized.slice(0, 87)}...`;
  }
  return sanitized || "Operation failed";
}
