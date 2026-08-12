export interface TokenUsage {
  input?: number;
  output?: number;
  total?: number;
}

type ServiceName =
  | "gemini"
  | "cloudflare"
  | "tezara"
  | "db"
  | "auth"
  | "flow"
  | "matrix"
  | "complete"
  | "boxes"
  | "wikipedia"
  | "literature"
  | "library"
  | "openalex"
  | "crossref"
  | "dashboard"
  | "cohere"
  | "positioning"
  | "cerebras"
  | "pdf-parser"
  | "rag-search"
  | "advisor"
  | "citation-cards"
  | "literature-matrix"
  | "outline";

export interface LogParams {
  service?: ServiceName;
  step?: string;
  durationMs?: number;
  data?: Record<string, unknown>;
  error?: unknown;
  tokens?: TokenUsage;
  filePath?: string;
  status?: "START" | "SUCCESS" | "FAILED" | "RETRY";
  blank?: "after" | "before" | "none";
  silentStart?: boolean;
  hidden?: boolean;
}

export interface LoggerInstance {
  flowId: string;
  lastTokens?: TokenUsage;
  lastPayloadPath?: string;
  info(arg1: string | Record<string, unknown>, params?: LogParams): void;
  error(arg1: string | Record<string, unknown>, params?: LogParams): void;
  warn(arg1: string | Record<string, unknown>, params?: LogParams): void;
  step(n: string, m?: Record<string, unknown>): void;
  file(r: string): void;
  data(l: string, v: unknown): void;
  preview(l: string, v: unknown): void;
  prompt(m: string, c: string): void;
  saveDebugPayload(
    s: string,
    m: string,
    p: string,
    r?: string,
  ): string | undefined;
  groupStart(event: string): void;
  groupEnd(event: string, durationMs: number): void;
  total(
    event: string,
    durationMs: number,
    p?: { service?: ServiceName; data?: Record<string, unknown> },
  ): void;
}

/**
 * Derives START, SUCCESS, or FAILED status from an event name's suffix.
 *
 * @param event - Event name possibly ending with a status suffix.
 * @returns The derived status, or empty string when none matches.
 */
function deriveStatus(event: string): string {
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

const isDev = () => process.env.NODE_ENV === "development";

const C_RESET = "\x1b[0m";
const C_GREEN = "\x1b[32m";
const C_RED = "\x1b[31m";
const C_YELLOW = "\x1b[33m";

/**
 * Returns the icon corresponding to a status.
 *
 * @param s - Status string (START, SUCCESS, FAILED, or RETRY).
 * @returns The matching icon.
 */
function statusIcon(s: string): string {
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
function statusColor(s: string): string {
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
function formatDuration(ms: number): string {
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
function extractReason(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export class Logger implements LoggerInstance {
  public readonly flowId: string;
  public lastTokens?: TokenUsage;
  public lastPayloadPath?: string;

  private _starts = new Map<string, number>();
  private readonly devMode = isDev();

  /**
   * Creates a logger whose flowId is attached to every log line.
   *
   * @param flowId - Identifier attached to every log line.
   */
  constructor(flowId: string) {
    this.flowId = flowId;
  }

  /**
   * Logs an info-level entry.
   *
   * @param arg1 - Event name or structured payload.
   * @param p - Optional log parameters.
   */
  info(arg1: string | Record<string, unknown>, p?: LogParams): void {
    this.write("info", arg1, p);
  }

  /**
   * Logs an error-level entry.
   *
   * @param arg1 - Event name or structured payload.
   * @param p - Optional log parameters.
   */
  error(arg1: string | Record<string, unknown>, p?: LogParams): void {
    this.write("error", arg1, p);
  }

  /**
   * Logs a warning-level entry for recoverable or expected failures.
   *
   * @param arg1 - Event name or structured payload.
   * @param p - Optional log parameters.
   */
  warn(arg1: string | Record<string, unknown>, p?: LogParams): void {
    this.write("warn", arg1, p);
  }

  /**
   * Records a step marker in the current flow.
   *
   * @param n - Step name.
   * @param m - Optional step metadata.
   */
  step(n: string, m?: Record<string, unknown>): void {
    void n;
    void m;
  }

  /**
   * Records a file reference for the current flow.
   *
   * @param r - File path.
   */
  file(r: string): void {
    void r;
  }

  /**
   * Records a labeled data snapshot for the current flow.
   *
   * @param l - Snapshot label.
   * @param v - Snapshot value.
   */
  data(l: string, v: unknown): void {
    void l;
    void v;
  }

  /**
   * Records a labeled preview for the current flow.
   *
   * @param l - Preview label.
   * @param v - Preview value.
   */
  preview(l: string, v: unknown): void {
    void l;
    void v;
  }

  /**
   * Records a prompt message for the current flow.
   *
   * @param m - Prompt message.
   * @param c - Contextual label.
   */
  prompt(m: string, c: string): void {
    void m;
    void c;
  }

  /**
   * Saves a debug payload for later inspection.
   *
   * @param s - Payload stage.
   * @param m - Payload message.
   * @param p - Payload path.
   * @param r - Optional request identifier.
   * @returns Path of the saved payload, or undefined when not saved.
   */
  saveDebugPayload(
    s: string,
    m: string,
    p: string,
    r?: string,
  ): string | undefined {
    void s;
    void m;
    void p;
    void r;
    return undefined;
  }

  /**
   * Marks the start of a log group.
   *
   * @param event - Group event name.
   */
  groupStart(event: string): void {
    void event;
  }

  /**
   * Marks the end of a log group.
   *
   * @param event - Group event name.
   * @param durationMs - Duration of the group in milliseconds.
   */
  groupEnd(event: string, durationMs: number): void {
    void event;
    void durationMs;
  }

  /**
   * Prints a total-duration summary line for a completed flow.
   *
   * @param event - Flow-level event name.
   * @param durationMs - Total duration in milliseconds.
   * @param p - Optional service and data metadata.
   */
  total(
    event: string,
    durationMs: number,
    p?: { service?: ServiceName; data?: Record<string, unknown> },
  ): void {
    if (this.devMode) {
      const timeTag = this.timestamp();
      console.log(
        `${timeTag} ${C_GREEN}✓${C_RESET} TOTAL ${event} (${formatDuration(durationMs)})`,
      );
      return;
    }

    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level: "info",
      event: `${event}_total`,
      flowId: this.flowId,
      service: p?.service ?? "flow",
      status: "TOTAL",
      durationMs: Math.round(durationMs),
    };
    if (p?.data) entry.data = p.data;
    console.info(JSON.stringify(entry));
  }

  /**
   * Returns the current time as "[HH:MM:SS]".
   *
   * @returns Current time string.
   */
  private timestamp(): string {
    const d = new Date();
    return `[${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}]`;
  }

  /**
   * Writes a single log line in dev or production format.
   *
   * @param level - Log level (info, error, or warn).
   * @param arg1 - Event name or structured payload.
   * @param p - Optional log parameters.
   */
  private write(
    level: "info" | "error" | "warn",
    arg1: string | Record<string, unknown>,
    p?: LogParams,
  ): void {
    if (this.devMode) {
      const event =
        typeof arg1 === "object" && arg1 !== null
          ? (((arg1 as Record<string, unknown>).step as string) ?? "unknown")
          : (arg1 as string);

      const status = deriveStatus(event);

      if (status === "START") {
        const baseEvent = event.replace(/_(start)$/, "");
        this._starts.set(baseEvent, performance.now());
        if (p?.silentStart || p?.hidden) {
          return;
        }
        const timeTag = this.timestamp();
        const icon = statusIcon("START");
        const color = statusColor("START");
        const annotation = p?.data?.summary ? ` ${p.data.summary}` : "";
        console.log(
          `${timeTag} START ${color}${icon}${C_RESET} ${baseEvent}${annotation}`,
        );
        return;
      }

      if (status === "SUCCESS" || status === "FAILED") {
        const baseEvent = event.replace(
          /_(success|failed|filtered|empty)$/,
          "",
        );
        const startTime = this._starts.get(baseEvent);
        let durStr = "";
        if (startTime != null) {
          durStr = ` (${formatDuration(performance.now() - startTime)})`;
          this._starts.delete(baseEvent);
        } else if (p?.durationMs != null) {
          durStr = ` (${formatDuration(p.durationMs)})`;
        } else if (
          p?.data &&
          typeof p.data === "object" &&
          "durationMs" in p.data
        ) {
          durStr = ` (${formatDuration((p.data as Record<string, unknown>).durationMs as number)})`;
        }

        const icon = statusIcon(status);
        const color = statusColor(status);
        const timeTag = this.timestamp();

        if (p?.hidden) {
          return;
        }

        const blank = p?.blank ?? "after";

        if (blank === "before") {
          console.log("");
        }

        console.log(
          `${timeTag} ${status} ${color}${icon}${C_RESET} ${baseEvent}${durStr}`,
        );

        if (p?.error != null) {
          console.log(`  ↳ reason: ${extractReason(p.error)}`);
        }
        if (blank === "after") {
          console.log("");
        }
        return;
      }
      return;
    }

    if (typeof arg1 === "object" && arg1 !== null) {
      const entry: Record<string, unknown> = { flowId: this.flowId, ...arg1 };
      console[level](
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level,
          ...entry,
        }),
      );
      return;
    }

    const event = arg1 as string;
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      event,
      flowId: this.flowId,
      service: p?.service ?? "flow",
      status: p?.status ?? deriveStatus(event),
    };
    if (p?.step) entry.step = p.step;
    if (p?.durationMs !== undefined)
      entry.durationMs = Math.round(p.durationMs);
    if (p?.data) entry.data = p.data;
    if (p?.tokens) {
      entry.tokens = p.tokens;
      this.lastTokens = p.tokens;
    }
    if (p?.error) entry.error = String(p.error);
    console[level](JSON.stringify(entry));
  }
}

/**
 * Generates a unique flow identifier in the form fl_<timestamp36>_<random>.
 *
 * @returns Unique flow identifier string.
 */
export function createFlowId(): string {
  return `fl_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}
