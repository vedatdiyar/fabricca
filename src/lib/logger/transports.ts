import { deriveStatus, formatLogLine, extractReason } from "../logger-format";
import type { LogParams, ServiceName, TokenUsage } from "./types";

/**
 * Handles dev-mode console formatting for a log write.
 *
 * @param level - Log level.
 * @param arg1 - Event or payload.
 * @param p - Log params.
 * @param starts - Map of start times for duration inference.
 * @returns True if handled (dev mode did output or suppressed), false if not dev.
 */
export function writeDev(
  level: "info" | "error" | "warn",
  arg1: string | Record<string, unknown>,
  p: LogParams | undefined,
  starts: Map<string, number>,
): boolean {
  const isDev = process.env.NODE_ENV === "development";
  if (!isDev) return false;

  const event =
    typeof arg1 === "object" && arg1 !== null
      ? (((arg1 as Record<string, unknown>).step as string) ?? "unknown")
      : (arg1 as string);

  const status = p?.status ?? deriveStatus(event);

  if (status === "START") {
    const baseEvent = event.replace(/_(start)$/, "");
    starts.set(baseEvent, performance.now());
    return true;
  }

  if (status === "RETRY") {
    if (p?.hidden) return true;
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
    return true;
  }

  if (status === "SUCCESS" || status === "FAILED") {
    if (p?.hidden) return true;

    const baseEvent = event.replace(/_(success|failed|filtered|empty)$/, "");

    let durationMs = p?.durationMs;
    if (durationMs === undefined) {
      const startTime = starts.get(baseEvent);
      if (startTime !== undefined) {
        durationMs = Math.round(performance.now() - startTime);
        starts.delete(baseEvent);
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
    return true;
  }
  return true;
}

/**
 * Handles production JSON console output.
 *
 * @param level - Log level.
 * @param arg1 - Event or payload.
 * @param p - Log params.
 * @param flowId - Flow identifier.
 * @param lastTokensRef - Mutable ref for last tokens.
 */
export function writeProd(
  level: "info" | "error" | "warn",
  arg1: string | Record<string, unknown>,
  p: LogParams | undefined,
  flowId: string,
  lastTokensRef: { value?: TokenUsage },
): void {
  if (typeof arg1 === "object" && arg1 !== null) {
    const entry: Record<string, unknown> = { flowId, ...arg1 };
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
    flowId,
    service: p?.service ?? "flow",
    status: p?.status ?? deriveStatus(event),
  };
  if (p?.step) entry.step = p.step;
  if (p?.durationMs !== undefined) entry.durationMs = Math.round(p.durationMs);
  if (p?.data) entry.data = p.data;
  if (p?.tokens) {
    entry.tokens = p.tokens;
    lastTokensRef.value = p.tokens;
  }
  if (p?.error) entry.error = String(p.error);
  console[level](JSON.stringify(entry));
}

/**
 * Prints total-duration summary line.
 *
 * @param event - Event name.
 * @param durationMs - Total duration.
 * @param flowId - Flow identifier (unused in prod JSON but kept for symmetry).
 * @param p - Optional metadata.
 */
export function writeTotal(
  event: string,
  durationMs: number,
  _flowId: string,
  p?: { service?: ServiceName; data?: Record<string, unknown> },
): void {
  const isDev = process.env.NODE_ENV === "development";
  void _flowId;
  if (isDev) {
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
    flowId: _flowId,
    service: p?.service ?? "flow",
    status: "TOTAL",
    durationMs: Math.round(durationMs),
  };
  if (p?.data) entry.data = p.data;
  console.info(JSON.stringify(entry));
}
