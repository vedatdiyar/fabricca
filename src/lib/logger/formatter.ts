/**
 * Konsol biçimlendirme, ANSI renkleri, emoji ve prefix/suffix yardimcilari.
 * Logger class'inin kullandigi tüm display mantigi burada toplanmistir.
 */

import { classifyError, getErrorDisplay } from "../error-utils";

export const A = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  gray: "\x1b[90m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  green: "\x1b[32m",
} as const;

export type ServiceName =
  | "gemini"
  | "cloudflare"
  | "tavily"
  | "tezara"
  | "db"
  | "auth"
  | "flow"
  | "matrix"
  | "originality"
  | "risk"
  | "complete"
  | "boxes"
  | "wikipedia"
  | "literature"
  | "library"
  | "openalex"
  | "crossref"
  | "dashboard";

export type LogLevel = "info" | "warn" | "error";
export interface TokenUsage {
  input?: number;
  output?: number;
  total?: number;
}

export interface LogParams {
  service?: ServiceName;
  step?: string;
  durationMs?: number;
  data?: Record<string, unknown>;
  error?: unknown;
  tokens?: TokenUsage;
  filePath?: string;
  status?: "START" | "SUCCESS" | "FAILED" | "RETRY";
}

const SERVICE_ANSI: Partial<Record<ServiceName, string>> = {
  matrix: A.blue,
  risk: A.yellow,
  literature: A.magenta,
  complete: A.green,
  dashboard: A.cyan,
};

const SERVICE_DISPLAY: Record<ServiceName, string> = {
  gemini: "GEMINI",
  cloudflare: "CFLARE",
  tavily: "TAVILY",
  tezara: "TEZARA",
  db: "DB",
  auth: "AUTH",
  flow: "FLOW",
  matrix: "MATRIX",

  originality: "ORIG",
  risk: "RISK",
  complete: "DONE",
  boxes: "BOXES",
  wikipedia: "WIKI",
  literature: "LITERATURE",
  library: "LIBRARY",
  openalex: "OPENALEX",
  crossref: "CROSSREF",
  dashboard: "DASHBOARD",
};

const ACTION_DISPLAY_MAP: Record<string, { emoji: string; label: string }> = {
  step: { emoji: "📍", label: "STEP" },
  file_ref: { emoji: "📁", label: "FILE" },
  data: { emoji: "📊", label: "DATA" },
  preview: { emoji: "👁️", label: "PREVIEW" },
  ai_prompt: { emoji: "💬", label: "PROMPT" },
  literature_search_start: { emoji: "🔍", label: "SEARCH" },
  literature_search_done: { emoji: "🔍", label: "SEARCH" },
  literature_merge_done: { emoji: "🔀", label: "MERGE" },
  literature_sifting_chunk: { emoji: "🧠", label: "SIFTING" },
  literature_sifting_done: { emoji: "🧠", label: "SIFTED" },
  literature_abstract_recovery_done: { emoji: "📄", label: "ABSTRACT" },
  literature_jury_done: { emoji: "⚖️", label: "JURY" },
  literature_crossref_done: { emoji: "🔗", label: "CROSSREF" },
  literature_box_failed: { emoji: "📦", label: "BOX" },
  literature_review_failed: { emoji: "📚", label: "REVIEW" },
  foundational_work_resolution_failed: { emoji: "📚", label: "FOUNDATION" },
  ai_request_start: { emoji: "🤖", label: "AI REQ" },
  ai_request_success: { emoji: "🤖", label: "AI REQ" },
  ai_request_failed: { emoji: "🤖", label: "AI REQ" },
  ai_retry_attempt: { emoji: "🔄", label: "RETRY" },
  search_filtered: { emoji: "🔍", label: "SEARCH" },
  search_empty: { emoji: "🔍", label: "SEARCH" },
};

const CONSOLE_METHOD: Record<string, "log" | "warn" | "error"> = {
  info: "log",
  warn: "warn",
  error: "error",
};

export { CONSOLE_METHOD };

export function getServiceColor(service: ServiceName): string {
  return SERVICE_ANSI[service] ?? A.cyan;
}

export function getTimestamp(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
}

export function getActionDisplay(event: string): {
  emoji: string;
  label: string;
} {
  const entry = ACTION_DISPLAY_MAP[event];
  if (entry) return entry;
  const cleaned = event
    .replace(/^(literature|ai)_/, "")
    .replace(/_(start|done|success|failed|filtered|empty)$/g, "")
    .toUpperCase();
  return { emoji: "📌", label: cleaned || event.toUpperCase() };
}

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

export function truncate(s: string, maxLen: number): string {
  return s.length <= maxLen ? s : s.slice(0, maxLen - 3) + "...";
}

export function processDataMetrics(data: Record<string, unknown>): string[] {
  const metrics: string[] = [];
  const before = data.before as number | undefined;
  const after = data.after as number | undefined;
  if (before !== undefined && after !== undefined)
    metrics.push(`${before} → ${after}`);
  if (data.count !== undefined) metrics.push(`Sayı: ${data.count}`);
  if (data.resultCount !== undefined) metrics.push(`${data.resultCount} sonuç`);
  if (data.rawCount !== undefined) metrics.push(`Ham: ${data.rawCount}`);
  if (data.mergedCount !== undefined)
    metrics.push(`Birleşme: ${data.mergedCount}`);
  return metrics;
}

export function getStatusIcon(status: string): string {
  if (status === "START") return "⏳";
  if (status === "SUCCESS") return "✓ ";
  if (status === "FAILED") return "✖ ";
  if (status === "RETRY") return "↻ ";
  return "⚪";
}

const startedEvents: Map<string, Set<string>> = new Map();

export function peekStarted(flowId: string, event: string): boolean {
  return startedEvents.get(flowId)?.has(event) ?? false;
}

export function markStarted(flowId: string, event: string): void {
  let set = startedEvents.get(flowId);
  if (!set) {
    set = new Set();
    startedEvents.set(flowId, set);
  }
  set.add(event);
}

export function serializeError(
  error: unknown,
): Record<string, unknown> | string {
  if (error instanceof Error) {
    return { message: error.message, name: error.name };
  }
  return String(error);
}

export function buildPrefix(
  service: ServiceName | string,
  status: string,
  stepLabel?: string,
): string {
  const time = getTimestamp();
  const icon = getStatusIcon(status);
  const stageDisplay =
    SERVICE_DISPLAY[service as ServiceName] ??
    (service as string).toUpperCase();
  let fullStage = stageDisplay;
  if (stepLabel) {
    fullStage = `${stageDisplay} › ${stepLabel}`;
  }
  const fixedStage = fullStage.padEnd(20).slice(0, 20);
  const color = getServiceColor(service as ServiceName);
  return `${A.dim}[${time}]${A.reset} ${icon} ${color}${fixedStage}${A.reset} ${A.gray}│${A.reset}`;
}

export function buildSuffix(params?: LogParams): string {
  const parts: string[] = [];

  if (params?.durationMs !== undefined)
    parts.push(`${Math.round(params.durationMs)}ms`);

  if (params?.data) parts.push(...processDataMetrics(params.data));

  if (params?.tokens) {
    const t = params.tokens;
    if (t.total !== undefined) parts.push(`${t.total} tkn`);
    else if (t.input !== undefined || t.output !== undefined)
      parts.push(`${t.input ?? 0} / ${t.output ?? 0}`);
  } else if (params?.data?.model) {
    parts.push(String(params.data.model).replace("-flash-lite", ""));
  }

  if (params?.data?.context) parts.push(String(params.data.context));

  const message = params?.step ?? "";

  if (params?.error) {
    const display = getErrorDisplay(params.error);
    parts.push(
      `[${classifyError(params.error).toUpperCase()}] ${display.title}`,
    );
  }

  const metricsStr = parts.length > 0 ? `  ${parts.join("  •  ")}` : "";
  return `${message}${metricsStr}`;
}

export function renderDevLine(data: Record<string, unknown>): string {
  const svc = (data.service ?? "flow") as ServiceName;
  const ev = String(data.event ?? data.step ?? "data");
  const rawStatus = String(data.status ?? "");
  const actDisplay = getActionDisplay(ev);
  const prefix = buildPrefix(svc, rawStatus, actDisplay.label);

  const parts: string[] = [];

  const nm = data.metrics as Record<string, unknown> | undefined;
  if (nm?.durationMs !== undefined)
    parts.push(`${Math.round(nm.durationMs as number)}ms`);

  const ed = data.data as Record<string, unknown> | undefined;
  if (ed) {
    parts.push(...processDataMetrics(ed));
    if (ed.context) parts.push(`📦 ${String(ed.context)}`);
  }

  const err = data.error as { message?: string } | undefined;
  if (err?.message) parts.push(`❌ ${err.message}`);

  const metricsStr = parts.length > 0 ? `  ${parts.join("  •  ")}` : "";
  const cleanMetrics = metricsStr.trim();
  if (cleanMetrics) {
    return `${prefix}  ${cleanMetrics}`;
  }
  return `${prefix}`;
}
