import { formatLogLine, extractReason } from "../logger-format";
import type {
  LogParams,
  LoggerInstance,
  ScopedTimer,
  ServiceName,
} from "./types";
import { writeDev, writeProd, writeTotal } from "./transports";

const isDev = () => process.env.NODE_ENV === "development";

/**
 * Generates a unique flow identifier.
 *
 * @returns Unique flow identifier string.
 */
export function createFlowId(): string {
  return `fl_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

export class Logger implements LoggerInstance {
  public readonly flowId: string;
  public lastTokens?: import("./types").TokenUsage;
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
    writeTotal(event, durationMs, this.flowId, p);
    // Keep legacy devMode direct log path for formatLogLine compatibility (transports handles both).
    void formatLogLine;
    void extractReason;
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
      const wasDev = writeDev(level, arg1, p, this._starts);
      if (wasDev) {
        // writeDev handles dev output; track tokens if present
        if (p?.tokens) this.lastTokens = p.tokens;
        return;
      }
    }

    // Production path (or dev fallback for unknown status)
    if (this.devMode && typeof arg1 === "string") {
      // For unknown status in dev, suppress (legacy behavior returned early)
      // Fall through to prod only if not dev handled — but we already returned for START/SUCCESS/FAILED/RETRY
      // So this path is only for non-standard events; keep silent as before.
      return;
    }

    const ref = { value: this.lastTokens };
    writeProd(level, arg1, p, this.flowId, ref);
    this.lastTokens = ref.value;
  }
}
