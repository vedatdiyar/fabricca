import {
  C_RESET,
  C_GREEN,
  deriveStatus,
  statusIcon,
  statusColor,
  formatDuration,
  extractReason,
} from "./logger-format";
import { createFlowId } from "./flow-id";

export { createFlowId };
export { deriveStatus, statusIcon, statusColor, formatDuration, extractReason };

export interface TokenUsage {
  input?: number;
  output?: number;
  total?: number;
}

export type ServiceName =
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
  saveDebugPayload?(
    s: string,
    m: string,
    p: string,
    r?: string,
  ): string | undefined;
  total(
    event: string,
    durationMs: number,
    p?: { service?: ServiceName; data?: Record<string, unknown> },
  ): void;
}

const isDev = () => process.env.NODE_ENV === "development";

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
        `${timeTag} TOTAL ${C_GREEN}✓${C_RESET} ${event} (${formatDuration(durationMs)})`,
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
