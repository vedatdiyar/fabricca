import pino from "pino";
import pretty from "pino-pretty";
import fs from "fs";
import path from "path";
import { classifyError, getErrorDisplay } from "./error-utils";

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
  status?: "START" | "SUCCESS" | "FAILED";
}

const isDevelopment = process.env.NODE_ENV === "development";
const PAYLOAD_DIR = ".next/logs";

const TIMESTAMP_WIDTH = 10;
const FLOW_ID_WIDTH = 14;
const MODULE_WIDTH = 12;
const ACTION_WIDTH = 22;

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

function getTimestamp(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
}

function truncateFlowId(fid: string): string {
  return fid.length <= 10 ? fid : fid.slice(0, 10);
}

function getModuleDisplay(service: ServiceName, params?: LogParams): string {
  let base = SERVICE_DISPLAY[service] ?? service.toUpperCase();
  if (params?.data?.thinkingLevel && service === "gemini") {
    const sl = String(params.data.thinkingLevel);
    const suffix = sl === "LOW" ? "L1" : sl === "HIGH" ? "L2" : "";
    if (suffix) base = `GEMINI/${suffix}`;
  }
  return base.padEnd(MODULE_WIDTH);
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

function getStatusTag(status: string): string {
  switch (status) {
    case "START":
      return "\x1b[33m⏳ START\x1b[0m";
    case "SUCCESS":
      return "\x1b[32m🟢 SUCCESS\x1b[0m";
    case "FAILED":
      return "\x1b[31m🔴 FAILED\x1b[0m";
    default:
      return "";
  }
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

/**
 * Central counter validator & normalizer.
 * Reads before/after and count-like fields from a data record,
 * validates internal consistency, and returns formatted metric strings.
 */
function processDataMetrics(data: Record<string, unknown>): string[] {
  const metrics: string[] = [];

  const before = data.before as number | undefined;
  const after = data.after as number | undefined;
  if (before !== undefined && after !== undefined) {
    if (before < after) {
      metrics.push(`⚠️ ${before}→${after} (asymmetric)`);
    } else if (before === after) {
      metrics.push(`${before} → ${after} (unchanged)`);
    } else {
      metrics.push(`${before} → ${after}`);
    }
  }

  if (data.count !== undefined) metrics.push(`📊 Sayı: ${data.count}`);
  if (data.resultCount !== undefined)
    metrics.push(`📊 ${data.resultCount} sonuç`);
  if (data.rawCount !== undefined) metrics.push(`🔢 Ham: ${data.rawCount}`);
  if (data.mergedCount !== undefined) metrics.push(`🔀 ${data.mergedCount}`);
  if (data.totalResults !== undefined)
    metrics.push(`📊 Toplam: ${data.totalResults}`);
  if (data.query) metrics.push(`🔍 ${truncate(String(data.query), 60)}`);
  if (data.reason) metrics.push(`📝 ${truncate(String(data.reason), 80)}`);
  if (data.starterPackCount !== undefined)
    metrics.push(`📦 ${data.starterPackCount}`);
  if (data.reservedPoolCount !== undefined)
    metrics.push(`📦 ${data.reservedPoolCount}`);
  if (data.enrichedCount !== undefined)
    metrics.push(`🔗 ${data.enrichedCount}`);
  if (data.requestedCount !== undefined)
    metrics.push(`🔢 ${data.requestedCount}`);
  if (data.resolvedCount !== undefined)
    metrics.push(`✅ ${data.resolvedCount}`);
  if (data.status) metrics.push(`🌐 HTTP ${data.status}`);
  if (data.errorCode) metrics.push(`❌ ${data.errorCode}`);
  if (data.chunkIndex !== undefined && data.totalChunks !== undefined) {
    metrics.push(`📦 ${data.chunkIndex}/${data.totalChunks}`);
  }
  if (data.keptInChunk !== undefined)
    metrics.push(`✅ ${data.keptInChunk} kept`);
  if (data.model) metrics.push(`🏷️ ${data.model}`);

  return metrics;
}

const pinoLogger = isDevelopment
  ? pino(
      pretty({
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
      }),
    )
  : pino({
      base: undefined,
      timestamp: pino.stdTimeFunctions.isoTime,
    });

/**
 * Deduplication guard for START events.
 * Prevents duplicate _start / START from rendering more than once per flow.
 */
const startedEvents: Map<string, Set<string>> = new Map();

function peekStarted(flowId: string, event: string): boolean {
  const set = startedEvents.get(flowId);
  if (!set) return false;
  return set.has(event);
}

function markStarted(flowId: string, event: string): void {
  let set = startedEvents.get(flowId);
  if (!set) {
    set = new Set();
    startedEvents.set(flowId, set);
  }
  set.add(event);
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

  /**
   * Log a named step within the current process flow.
   */
  step(stepName: string, metadata?: Record<string, unknown>): void {
    if (!isDevelopment) return;
    const prefix = this.buildPrefix("flow", "step");
    const meta =
      metadata && Object.keys(metadata).length > 0
        ? ` ${JSON.stringify(metadata)}`
        : "";
    console.log(`${prefix}| 📍 ${stepName}${meta}`);
  }

  /**
   * Log a file reference (path or URL) for traceability.
   */
  file(ref: string): void {
    if (!isDevelopment) return;
    const prefix = this.buildPrefix("flow", "file_ref");
    console.log(`${prefix}| 📁 ${ref}`);
  }

  /**
   * Log an arbitrary labeled data point.
   */
  data(label: string, value: unknown): void {
    if (!isDevelopment) return;
    const prefix = this.buildPrefix("flow", "data");
    const display =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    console.log(`${prefix}| 📊 ${label}: ${truncate(display, 120)}`);
  }

  /**
   * Log a preview of data with truncation for terminal readability.
   */
  preview(label: string, value: unknown): void {
    if (!isDevelopment) return;
    const prefix = this.buildPrefix("flow", "preview");
    const raw =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    const display = truncate(raw, 200);
    console.log(`${prefix}| 👁️ ${label}: ${display}`);
  }

  /**
   * Log an AI prompt sent to a model.
   */
  prompt(model: string, content: string): void {
    if (!isDevelopment) return;
    const prefix = this.buildPrefix("gemini", "ai_prompt");
    const preview = truncate(content.replace(/\n/g, " "), 160);
    console.log(`${prefix}| 💬 [${model}] ${preview}`);
  }

  /**
   * Save a debug payload to disk for later inspection.
   * @returns The file path of the saved payload, or undefined on failure / production.
   */
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
      const fileName = `${cleanId}_${stage}_payload.json`;
      const filePath = path.join(dir, fileName);
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

  // ─────────────────────────── Private ───────────────────────────────────

  private write(
    level: "info" | "warn" | "error",
    arg1: string | Record<string, unknown>,
    params?: LogParams,
  ): void {
    if (typeof arg1 === "object" && arg1 !== null) {
      const entry: Record<string, unknown> = { flowId: this.flowId, ...arg1 };
      const rawStatus = entry.status as string | undefined;

      if (rawStatus === "START") {
        const dedupKey = (entry.step as string) ?? "obj_start";
        if (peekStarted(this.flowId, dedupKey)) return;
        markStarted(this.flowId, dedupKey);
      }

      if (isDevelopment) this.renderDevLine(entry);
      else pinoLogger[level](entry);
      return;
    }

    const event = arg1 as string;
    const service = params?.service ?? "flow";
    const entry: Record<string, unknown> = {
      event,
      flowId: this.flowId,
      service,
    };

    if (params?.step) entry.step = params.step;
    if (params?.durationMs !== undefined) {
      entry.durationMs = Math.round(params.durationMs);
    }
    if (params?.data) entry.data = params.data;
    if (params?.tokens) entry.tokens = params.tokens;

    if (event === "ai_request_success" && params?.tokens) {
      this.lastTokens = params.tokens;
    }

    if (level === "error") {
      const err = params?.error;
      entry.error = {
        name: err instanceof Error ? err.name : "UnknownError",
        message:
          err instanceof Error
            ? err.message
            : err != null
              ? String(err)
              : "Unknown error",
      };
      if (err instanceof Error && err.stack) {
        (entry.error as Record<string, unknown>).stack = err.stack;
      }
    }

    const status = params?.status ?? deriveStatus(event);

    if (status === "START" && peekStarted(this.flowId, event)) return;
    if (status === "START") markStarted(this.flowId, event);

    if (isDevelopment) {
      this.renderEventLine(service, event, status, params);
    } else {
      if (!status) return;
      entry.status = status;
      pinoLogger[level](entry);
    }
  }

  private renderEventLine(
    service: ServiceName,
    event: string,
    status: string,
    params?: LogParams,
  ): void {
    const prefix = this.buildPrefix(service, event);
    const suffix = this.buildSuffix(event, status, params);
    console.log(`${prefix}${suffix}`);
  }

  private buildPrefix(service: ServiceName | string, event: string): string {
    const time = getTimestamp();
    const reqId = truncateFlowId(this.flowId);
    const svc = service as ServiceName;
    const moduleDisplay = getModuleDisplay(svc);
    const actionDisplay = getActionDisplay(event);

    const timePadded = `[${time}]`.padEnd(TIMESTAMP_WIDTH);
    const idPadded = `[${reqId}]`.padEnd(FLOW_ID_WIDTH);
    const modPadded = `[${moduleDisplay}]`.padEnd(MODULE_WIDTH + 2);
    const actionPadded = `${actionDisplay.emoji} ${actionDisplay.label}`.padEnd(
      ACTION_WIDTH,
    );

    return `${timePadded} ${idPadded} ${modPadded} ${actionPadded}`;
  }

  private buildSuffix(
    event: string,
    status: string,
    params?: LogParams,
  ): string {
    const parts: string[] = [];

    if (params?.step && params.step !== event) {
      parts.push(params.step);
    }

    const statusTag = getStatusTag(status);
    if (statusTag) parts.push(statusTag);

    if (params?.data) {
      const ctx =
        params.data.context ?? params.data.boxTitle ?? params.data.subBox;
      if (ctx) parts.push(`📦 ${ctx}`);
    }

    let suffix = "";
    if (parts.length > 0) {
      suffix += ` | ${parts.join(" • ")}`;
    }

    const metricParts: string[] = [];

    if (params?.durationMs !== undefined) {
      metricParts.push(`⏱️ ${Math.round(params.durationMs)}ms`);
    }

    if (params?.filePath) {
      metricParts.push(`📁 ${params.filePath.replace(/^src\//, "")}`);
    }

    if (params?.tokens) {
      const t = params.tokens;
      if ((t.input ?? 0) > 0 || (t.output ?? 0) > 0) {
        metricParts.push(`📥 ${t.input ?? "?"}`, `📤 ${t.output ?? "?"}`);
      }
      if (t.total !== undefined) metricParts.push(`💭 ${t.total}tkn`);
    } else if (params?.data?.model) {
      metricParts.push(`🏷️ ${params.data.model}`);
    }

    if (params?.data) {
      const dataMetrics = processDataMetrics(params.data);
      metricParts.push(...dataMetrics);
    }

    if (params?.error) {
      const err = params.error;
      const display = getErrorDisplay(err);
      const scenario = classifyError(err);
      metricParts.push(`❌ [${scenario.toUpperCase()}] ${display.title}`);
    }

    if (metricParts.length > 0) {
      suffix += ` | ${metricParts.join(" | ")}`;
    }

    if (
      event === "literature_sifting_done" &&
      typeof params?.data?.before === "number" &&
      typeof params?.data?.after === "number" &&
      params.data.before > 40 &&
      params.data.after <= 2
    ) {
      suffix += ` | ⚠️ DÜŞÜK KABUL ORANI (dosya: ${this.lastPayloadPath ?? "N/A"})`;
    }

    return suffix;
  }

  private renderDevLine(data: Record<string, unknown>): void {
    const time = getTimestamp();
    const reqId = truncateFlowId(this.flowId);
    const svc = String(data.service ?? "flow") as ServiceName;
    const moduleDisplay = getModuleDisplay(svc);

    const event = String(data.event ?? data.step ?? "data");
    const actionDisplay = getActionDisplay(event);

    const timePadded = `[${time}]`.padEnd(TIMESTAMP_WIDTH);
    const idPadded = `[${reqId}]`.padEnd(FLOW_ID_WIDTH);
    const modPadded = `[${moduleDisplay}]`.padEnd(MODULE_WIDTH + 2);
    const actionPadded = `${actionDisplay.emoji} ${actionDisplay.label}`.padEnd(
      ACTION_WIDTH,
    );

    let line = `${timePadded} ${idPadded} ${modPadded} ${actionPadded}`;

    const msgParts: string[] = [];

    const step = data.step ? String(data.step) : "";
    if (step && step !== event) msgParts.push(step);

    const rawStatus = String(data.status ?? "");
    if (rawStatus) msgParts.push(getStatusTag(rawStatus));

    if (msgParts.length > 0) line += ` | ${msgParts.join(" • ")}`;

    const metricParts: string[] = [];

    const metrics = data.metrics as Record<string, unknown> | undefined;
    if (metrics) {
      const durMs = metrics.durationMs as number | undefined;
      if (durMs !== undefined) metricParts.push(`⏱️ ${Math.round(durMs)}ms`);
      const dur = metrics.duration as string | undefined;
      if (dur !== undefined && durMs === undefined)
        metricParts.push(`⏱️ ${dur}`);
      const rc = metrics.resultCount as number | undefined;
      if (rc !== undefined) metricParts.push(`📊 ${rc} sonuç`);
    }

    const extraData = data.data as Record<string, unknown> | undefined;
    if (extraData) {
      const dataMetrics = processDataMetrics(extraData);
      metricParts.push(...dataMetrics);
    }

    const diagnostics = data.diagnostics as Record<string, unknown> | undefined;
    if (diagnostics) {
      const msg = diagnostics.message ? String(diagnostics.message) : "";
      if (msg) metricParts.push(`❌ ${truncate(msg, 120)}`);
    }

    const err = data.error as { message?: string } | undefined;
    if (err && err.message && !diagnostics) {
      metricParts.push(`❌ ${truncate(err.message, 120)}`);
    }

    if (metricParts.length > 0) line += ` | ${metricParts.join(" | ")}`;

    console.log(line);
  }
}

export function createFlowId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `fl_${timestamp}_${random}`;
}
