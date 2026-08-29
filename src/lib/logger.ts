import {
  deriveStatus,
  formatDuration,
  formatLogLine,
  extractReason,
} from "./logger-format";
export { deriveStatus, formatDuration, formatLogLine, extractReason };

/**
 * Generates a unique flow identifier in the form fl_<timestamp36>_<random>.
 *
 * @returns Unique flow identifier string.
 */
export function createFlowId(): string {
  return `fl_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

export interface TokenUsage {
  input?: number;
  output?: number;
  total?: number;
}

export type ServiceName =
  | "gemini"
  | "cloudflare"
  | "thesis-search"
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
  | "pdf-parser"
  | "rag-search"
  | "advisor"
  | "citation-cards"
  | "literature-matrix"
  | "outline"
  | "thesis-architecture"
  | "pipeline"
  | "onboarding"
  | "ui";

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

export interface ScopedTimer {
  done(summary?: string): void;
  fail(error: unknown, summary?: string): void;
}

export interface LoggerInstance {
  flowId: string;
  lastTokens?: TokenUsage;
  lastPayloadPath?: string;
  info(arg1: string | Record<string, unknown>, params?: LogParams): void;
  error(arg1: string | Record<string, unknown>, params?: LogParams): void;
  warn(arg1: string | Record<string, unknown>, params?: LogParams): void;
  success(event: string, params?: LogParams): void;
  failed(event: string, params?: LogParams): void;
  retry(event: string, params?: LogParams): void;
  time<T>(event: string, fn: () => Promise<T>, params?: LogParams): Promise<T>;
  startTimer(event: string, params?: LogParams): ScopedTimer;
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
   * Times an asynchronous operation and logs its completion or failure.
   *
   * @param event - Event name to log.
   * @param fn - Asynchronous function to execute and time.
   * @param p - Optional log parameters.
   * @returns Result of the executed function.
   */
  async time<T>(
    event: string,
    fn: () => Promise<T>,
    p?: LogParams,
  ): Promise<T> {
    const startedAt = performance.now();
    try {
      const result = await fn();
      const durationMs = Math.round(performance.now() - startedAt);
      this.success(event, { ...p, durationMs });
      return result;
    } catch (err) {
      const durationMs = Math.round(performance.now() - startedAt);
      this.failed(event, { ...p, durationMs, error: err });
      throw err;
    }
  }

  /**
   * Starts a manual scoped stopwatch timer that logs upon done() or fail().
   *
   * @param event - Event name to log.
   * @param p - Optional log parameters.
   * @returns Scoped timer object with done and fail callbacks.
   */
  startTimer(event: string, p?: LogParams): ScopedTimer {
    const startedAt = performance.now();
    let finished = false;
    return {
      done: (summary?: string) => {
        if (finished) return;
        finished = true;
        const durationMs = Math.round(performance.now() - startedAt);
        const data = summary ? { ...p?.data, summary } : p?.data;
        this.success(event, { ...p, durationMs, data });
      },
      fail: (error: unknown, summary?: string) => {
        if (finished) return;
        finished = true;
        const durationMs = Math.round(performance.now() - startedAt);
        const data = summary ? { ...p?.data, summary } : p?.data;
        this.failed(event, { ...p, durationMs, error, data });
      },
    };
  }

  /**
   * Logs a successful operation entry.
   *
   * @param event - Event name.
   * @param p - Optional log parameters.
   */
  success(event: string, p?: LogParams): void {
    this.write("info", event, { ...p, status: "SUCCESS" });
  }

  /**
   * Logs a failed operation entry.
   *
   * @param event - Event name.
   * @param p - Optional log parameters.
   */
  failed(event: string, p?: LogParams): void {
    this.write("error", event, { ...p, status: "FAILED" });
  }

  /**
   * Logs a retry operation entry.
   *
   * @param event - Event name.
   * @param p - Optional log parameters.
   */
  retry(event: string, p?: LogParams): void {
    this.write("warn", event, { ...p, status: "RETRY" });
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
   * Prints a total-duration summary line for a completed flow or pipeline.
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
      const summary = p?.data?.summary as string | undefined;
      console.log(
        formatLogLine({
          status: "TOTAL",
          service: p?.service ?? "pipeline",
          event: `${event} completed`,
          summary,
          durationMs,
        }),
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

      const status = p?.status ?? deriveStatus(event);

      // START events are silently recorded to avoid terminal noise.
      if (status === "START") {
        const baseEvent = event.replace(/_(start)$/, "");
        this._starts.set(baseEvent, performance.now());
        return;
      }

      if (status === "RETRY") {
        if (p?.hidden) return;
        const baseEvent = event.replace(/_(retry)$/, "");
        const summary = (p?.data?.summary as string) ?? undefined;
        console.log(
          formatLogLine({
            status: "RETRY",
            service: p?.service,
            event: baseEvent,
            summary,
            backoffMs: p?.durationMs,
          }),
        );
        if (p?.error != null) {
          console.log(`  ↳ reason: ${extractReason(p.error)}`);
        }
        return;
      }

      if (status === "SUCCESS" || status === "FAILED") {
        if (p?.hidden) return;

        const baseEvent = event.replace(
          /_(success|failed|filtered|empty)$/,
          "",
        );

        let durationMs = p?.durationMs;
        if (durationMs === undefined) {
          const startTime = this._starts.get(baseEvent);
          if (startTime !== undefined) {
            durationMs = Math.round(performance.now() - startTime);
            this._starts.delete(baseEvent);
          } else if (
            p?.data &&
            typeof p.data === "object" &&
            "durationMs" in p.data
          ) {
            durationMs = Math.round(
              (p.data as Record<string, unknown>).durationMs as number,
            );
          }
        }

        const summary = (p?.data?.summary as string) ?? undefined;
        console.log(
          formatLogLine({
            status,
            service: p?.service,
            event: baseEvent,
            summary,
            durationMs,
          }),
        );

        if (p?.error != null) {
          console.log(`  ↳ reason: ${extractReason(p.error)}`);
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
