import fs from "fs";
import path from "path";
import { classifyError, getErrorDisplay } from "./error-utils";

const originalConsoleLog = console.log;
const FILTER_PATTERNS = [
  "Cache skipped reason",
  "api.openalex.org",
  "api.crossref.org",
  "fetchCache = default-no-store",
  "cache skip",
];

let lastRenderedFlowId: string | null = null;

console.log = (...args: unknown[]) => {
  const message = typeof args[0] === "string" ? args[0] : "";
  if (FILTER_PATTERNS.some((p) => message.includes(p))) return;

  if (isDevelopment) {
    const match = message.match(/\[(fl_\w+)\]/);
    if (match) {
      const currentFlowId = match[1];
      if (lastRenderedFlowId !== null && lastRenderedFlowId !== currentFlowId) {
        originalConsoleLog(
          "\x1b[90m└───────────────────────────────────────────────────────────────────────────────────────────────────┘\x1b[0m",
        );
        originalConsoleLog(
          `\x1b[90m┌── [${currentFlowId}] ─────────────────────────────────────────────────────────────────────────────┐\x1b[0m`,
        );
      } else if (lastRenderedFlowId === null) {
        originalConsoleLog(
          `\x1b[90m┌── [${currentFlowId}] ─────────────────────────────────────────────────────────────────────────────┐\x1b[0m`,
        );
      }
      lastRenderedFlowId = currentFlowId;
    }
  }
  originalConsoleLog(...args);
};

export type LogLevel = "info" | "warn" | "error";
export type LogEvent = "login_success" | "login_failed" | "flow_complete";
export type ServiceName =
  | "gemini"
  | "cloudflare"
  | "tavily"
  | "tezara"
  | "db"
  | "auth"
  | "flow"
  | "matrix"
  | "enrichment"
  | "originality"
  | "risk"
  | "complete"
  | "boxes"
  | "wikipedia"
  | "literature"
  | "library"
  | "openalex"
  | "crossref";

export interface TokenUsage {
  input?: number;
  output?: number;
  total?: number;
}

export interface PayloadData {
  flowId: string;
  timestamp: string;
  stage: string;
  module: string;
  prompt: string;
  response?: string;
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

const isDevelopment = process.env.NODE_ENV === "development";
const PAYLOAD_DIR = ".next/logs";

const A = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  gray: "\x1b[90m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  green: "\x1b[32m",
} as const;

const SERVICE_ANSI: Partial<Record<ServiceName, string>> = {
  matrix: A.blue,
  risk: A.yellow,
  literature: A.magenta,
  complete: A.green,
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
  enrichment: "ENRICH",
  originality: "ORIG",
  risk: "RISK",
  complete: "DONE",
  boxes: "BOXES",
  wikipedia: "WIKI",
  literature: "LITERATURE",
  library: "LIBRARY",
  openalex: "OPENALEX",
  crossref: "CROSSREF",
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

function getServiceColor(service: ServiceName): string {
  return SERVICE_ANSI[service] ?? A.cyan;
}

function getTimestamp(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
}

function getActionDisplay(event: string): { emoji: string; label: string } {
  const entry = ACTION_DISPLAY_MAP[event];
  if (entry) return entry;
  const cleaned = event
    .replace(/^(literature|ai)_/, "")
    .replace(/_(start|done|success|failed|filtered|empty)$/g, "")
    .toUpperCase();
  return { emoji: "📌", label: cleaned || event.toUpperCase() };
}

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

function truncate(s: string, maxLen: number): string {
  return s.length <= maxLen ? s : s.slice(0, maxLen - 3) + "...";
}

function processDataMetrics(data: Record<string, unknown>): string[] {
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

function getStatusIcon(status: string): string {
  if (status === "START") return "⏳";
  if (status === "SUCCESS") return "✓ ";
  if (status === "FAILED") return "✖ ";
  if (status === "RETRY") return "↻ ";
  return "⚪";
}

const startedEvents: Map<string, Set<string>> = new Map();

function peekStarted(flowId: string, event: string): boolean {
  return startedEvents.get(flowId)?.has(event) ?? false;
}

function markStarted(flowId: string, event: string): void {
  let set = startedEvents.get(flowId);
  if (!set) {
    set = new Set();
    startedEvents.set(flowId, set);
  }
  set.add(event);
}

function serializeError(error: unknown): Record<string, unknown> | string {
  if (error instanceof Error) {
    return { message: error.message, name: error.name };
  }
  return String(error);
}

export class Logger {
  public readonly flowId: string;
  public lastTokens?: TokenUsage;
  public lastPayloadPath?: string;

  constructor(flowId: string) {
    this.flowId = flowId;
  }

  info(arg1: string | Record<string, unknown>, params?: LogParams): void {
    this.write("info", arg1, params);
  }

  warn(arg1: string | Record<string, unknown>, params?: LogParams): void {
    this.write("warn", arg1, params);
  }

  error(arg1: string | Record<string, unknown>, params?: LogParams): void {
    this.write("error", arg1, params);
  }

  step(stepName: string, _metadata?: Record<string, unknown>): void {
    if (!isDevelopment) return;
    void _metadata;
    const actDisplay = getActionDisplay("step");
    const prefix = this.buildPrefix("flow", "SUCCESS", actDisplay.label);
    console.log(`${prefix}  ${stepName}`);
  }

  file(ref: string): void {
    if (!isDevelopment) return;
    const actDisplay = getActionDisplay("file_ref");
    const prefix = this.buildPrefix("flow", "SUCCESS", actDisplay.label);
    console.log(`${prefix}  ${ref}`);
  }

  data(label: string, value: unknown): void {
    if (!isDevelopment) return;
    const actDisplay = getActionDisplay("data");
    const prefix = this.buildPrefix("flow", "SUCCESS", actDisplay.label);
    const display =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    console.log(`${prefix}  ${label}: ${truncate(display, 100)}`);
  }

  preview(label: string, value: unknown): void {
    if (!isDevelopment) return;
    const actDisplay = getActionDisplay("preview");
    const prefix = this.buildPrefix("flow", "SUCCESS", actDisplay.label);
    const raw =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    console.log(`${prefix}  ${label}: ${truncate(raw, 120)}`);
  }

  prompt(model: string, content: string): void {
    if (!isDevelopment) return;
    const actDisplay = getActionDisplay("ai_prompt");
    const prefix = this.buildPrefix("gemini", "SUCCESS", actDisplay.label);
    console.log(
      `${prefix}  [${model}] ${truncate(content.replace(/\n/g, " "), 120)}`,
    );
  }

  saveDebugPayload(
    stage: string,
    module: string,
    prompt: string,
    response?: string,
  ): string | undefined {
    if (!isDevelopment) return;
    try {
      const dir = path.resolve(process.cwd(), PAYLOAD_DIR);
      fs.mkdirSync(dir, { recursive: true });
      const cleanId = this.flowId.replace(/[^a-zA-Z0-9_-]/g, "_");
      const filePath = path.join(dir, `${cleanId}_${stage}_payload.json`);
      const payload: PayloadData = {
        flowId: this.flowId,
        timestamp: new Date().toISOString(),
        stage,
        module,
        prompt,
        response,
      };
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
      this.lastPayloadPath = filePath;
      return filePath;
    } catch {
      return;
    }
  }

  private write(
    level: "info" | "warn" | "error",
    arg1: string | Record<string, unknown>,
    params?: LogParams,
  ): void {
    if (typeof arg1 === "object" && arg1 !== null) {
      const entry: Record<string, unknown> = { flowId: this.flowId, ...arg1 };
      if (
        entry.status === "START" &&
        peekStarted(this.flowId, (entry.step as string) ?? "obj_start")
      )
        return;
      if (entry.status === "START")
        markStarted(this.flowId, (entry.step as string) ?? "obj_start");

      if (isDevelopment) {
        this.renderDevLine(entry);
      } else {
        console[CONSOLE_METHOD[level]](
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level,
            ...entry,
          }),
        );
      }
      return;
    }

    const event = arg1 as string;
    const service = params?.service ?? "flow";
    const status = params?.status ?? deriveStatus(event);

    if (status === "START" && peekStarted(this.flowId, event)) return;
    if (status === "START") markStarted(this.flowId, event);

    if (isDevelopment) {
      const actDisplay = getActionDisplay(event);
      const prefix = this.buildPrefix(service, status, actDisplay.label);
      const suffix = this.buildSuffix(params);
      const cleanSuffix = suffix.trim();
      if (cleanSuffix) {
        console.log(`${prefix}  ${cleanSuffix}`);
      } else {
        console.log(`${prefix}`);
      }
    } else {
      const entry: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        level,
        event,
        flowId: this.flowId,
        service,
        status,
      };
      if (params?.step) entry.step = params.step;
      if (params?.durationMs !== undefined)
        entry.durationMs = Math.round(params.durationMs);
      if (params?.data) entry.data = params.data;
      if (params?.tokens) entry.tokens = params.tokens;
      if (params?.error) entry.error = serializeError(params.error);
      console[CONSOLE_METHOD[level]](JSON.stringify(entry));
    }
  }

  private buildPrefix(
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

  private buildSuffix(params?: LogParams): string {
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

  private renderDevLine(data: Record<string, unknown>): void {
    const svc = (data.service ?? "flow") as ServiceName;
    const ev = String(data.event ?? data.step ?? "data");
    const rawStatus = String(data.status ?? "");
    const actDisplay = getActionDisplay(ev);
    const prefix = this.buildPrefix(svc, rawStatus, actDisplay.label);

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
      console.log(`${prefix}  ${cleanMetrics}`);
    } else {
      console.log(`${prefix}`);
    }
  }
}

export function createFlowId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `fl_${timestamp}_${random}`;
}
