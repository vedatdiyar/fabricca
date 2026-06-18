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
  status?: "SUCCESS" | "FAILED";
}

const isDevelopment = process.env.NODE_ENV === "development";
const PAYLOAD_DIR = ".next/logs";
const MODULE_DISPLAY_WIDTH = 12;
const ACTION_DISPLAY_WIDTH = 22;

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
  return base.padEnd(MODULE_DISPLAY_WIDTH);
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

export function createFlowId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `fl_${timestamp}_${random}`;
}

function getStatusTag(status: string): string {
  switch (status) {
    case "SUCCESS":
      return "\x1b[32m🟢 SUCCESS\x1b[0m";
    case "FAILED":
      return "\x1b[31m🔴 FAILED\x1b[0m";
    default:
      return "";
  }
}

function deriveStatus(event: string): string {
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

  private write(
    level: "info" | "warn" | "error",
    arg1: string | Record<string, unknown>,
    params?: LogParams,
  ): void {
    if (typeof arg1 === "object" && arg1 !== null) {
      const entry: Record<string, unknown> = { flowId: this.flowId, ...arg1 };
      const status = entry.status as string | undefined;
      if (status && status !== "SUCCESS" && status !== "FAILED") return;
      if (isDevelopment) this.renderDevLine(entry);
      else pinoLogger[level](entry);
      return;
    } else {
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
      if (params?.data) {
        entry.data = params.data;
      }
      if (params?.tokens) {
        entry.tokens = params.tokens;
      }

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
          entry.error = {
            ...(entry.error as Record<string, unknown>),
            stack: err.stack,
          };
        }
      }

      const status = params?.status ?? deriveStatus(event);
      if (!status) return;

      if (isDevelopment) {
        this.renderEventLine(service, event, status, params);
      } else {
        entry.status = status;
        pinoLogger[level](entry);
      }
    }
  }

  private renderEventLine(
    service: ServiceName,
    event: string,
    status: string,
    params?: LogParams,
  ): void {
    const statusTag = getStatusTag(status);
    console.log(this.buildLine(service, event, statusTag, params));
  }

  private renderDevLine(data: Record<string, unknown>): void {
    const time = getTimestamp();
    const reqId = truncateFlowId(this.flowId);
    const svc = String(data.service ?? "flow") as ServiceName;
    const moduleDisplay = getModuleDisplay(svc, {
      data,
    } as unknown as LogParams);
    const event = String(data.event ?? data.step ?? "data");
    const actionDisplay = getActionDisplay(event);

    // ARTIK BURASI DA SABİT HİZALI: ACTION_DISPLAY_WIDTH katı olarak korunuyor
    const actionPadded = `${actionDisplay.emoji} ${actionDisplay.label}`.padEnd(
      ACTION_DISPLAY_WIDTH,
    );
    let line = `[${time}] [${reqId}] [${moduleDisplay}] ${actionPadded}`;

    const msgParts: string[] = [];
    const step = data.step ? String(data.step) : "";
    if (step) msgParts.push(step);

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
      if (extraData.count !== undefined)
        metricParts.push(`📊 Sayı: ${extraData.count}`);
      if (extraData.resultCount !== undefined)
        metricParts.push(`📊 ${extraData.resultCount} sonuç`);
      if (extraData.model) metricParts.push(`🏷️ ${extraData.model}`);
      if (extraData.query)
        metricParts.push(`🔍 ${truncate(String(extraData.query), 60)}`);
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

  private buildLine(
    service: ServiceName,
    event: string,
    statusTag: string,
    params?: LogParams,
  ): string {
    const time = getTimestamp();
    const reqId = truncateFlowId(this.flowId);
    const moduleDisplay = getModuleDisplay(service, params);
    const actionDisplay = getActionDisplay(event);
    const actionPadded = `${actionDisplay.emoji} ${actionDisplay.label}`.padEnd(
      ACTION_DISPLAY_WIDTH,
    );

    let line = `[${time}] [${reqId}] [${moduleDisplay}] ${actionPadded}`;

    const msgParts: string[] = [];
    if (params?.step && params.step !== event) {
      msgParts.push(params.step);
    }
    if (statusTag) {
      msgParts.push(statusTag);
    }
    if (msgParts.length > 0) {
      line += ` | ${msgParts.join(" • ")}`;
    }

    const metricParts: string[] = [];
    if (params?.durationMs !== undefined) {
      metricParts.push(`⏱️ ${Math.round(params.durationMs)}ms`);
    }
    if (params?.filePath) {
      const cleanPath = params.filePath.replace(/^src\//, "");
      metricParts.push(`📁 ${cleanPath}`);
    }
    if (params?.tokens) {
      const t = params.tokens;
      if (params?.data?.model) {
        metricParts.push(`🏷️ ${params.data.model}`);
      }
      metricParts.push(`📥 ${t.input ?? "?"}`, `📤 ${t.output ?? "?"}`);
      if (t.total !== undefined) metricParts.push(`💭 ${t.total}tkn`);
    } else if (params?.data?.model) {
      metricParts.push(`🏷️ ${params.data.model}`);
    }

    if (params?.data && !params.data.model) {
      const d = params.data;
      if (d.query) metricParts.push(`🔍 ${truncate(String(d.query), 60)}`);
      if (d.resultCount !== undefined)
        metricParts.push(`📊 ${d.resultCount} sonuç`);
      if (d.count !== undefined) metricParts.push(`📊 Sayı: ${d.count}`);
      if (d.rawCount !== undefined) metricParts.push(`🔢 Ham: ${d.rawCount}`);
      if (d.mergedCount !== undefined) metricParts.push(`🔀 ${d.mergedCount}`);
      if (d.before !== undefined && d.after !== undefined)
        metricParts.push(`${d.before} → ${d.after}`);
      if (d.totalResults !== undefined)
        metricParts.push(`📊 Toplam: ${d.totalResults}`);
      if (d.reason) metricParts.push(`📝 ${truncate(String(d.reason), 80)}`);
      if (d.starterPackCount !== undefined)
        metricParts.push(`📦 ${d.starterPackCount}`);
      if (d.reservedPoolCount !== undefined)
        metricParts.push(`📦 ${d.reservedPoolCount}`);
      if (d.enrichedCount !== undefined)
        metricParts.push(`🔗 ${d.enrichedCount}`);
      if (d.requestedCount !== undefined)
        metricParts.push(`🔢 ${d.requestedCount}`);
      if (d.resolvedCount !== undefined)
        metricParts.push(`✅ ${d.resolvedCount}`);
      if (d.status) metricParts.push(`🌐 HTTP ${d.status}`);
      if (d.errorCode) metricParts.push(`❌ ${d.errorCode}`);
      if (d.chunkIndex !== undefined)
        metricParts.push(`📦 ${d.chunkIndex}/${d.totalChunks}`);
      if (d.keptInChunk !== undefined)
        metricParts.push(`✅ ${d.keptInChunk} kept`);
    }

    if (params?.error) {
      const err = params.error;
      const display = getErrorDisplay(err);
      const scenario = classifyError(err);
      metricParts.push(`❌ [${scenario.toUpperCase()}] ${display.title}`);
    }

    if (metricParts.length > 0) {
      line += ` | ${metricParts.join(" | ")}`;
    }

    if (
      event === "literature_sifting_done" &&
      typeof params?.data?.before === "number" &&
      typeof params?.data?.after === "number" &&
      params.data.before > 40 &&
      params.data.after <= 2
    ) {
      line += ` | ⚠️ DÜŞÜK KABUL ORANI (dosya: ${this.lastPayloadPath ?? "N/A"})`;
    }

    return line;
  }

  // ==========================================================================
  // SIZINTI YAPAN ESKİ METOTLAR ARTIK TAMAMEN SESSİZCE UNUTULDU (NO-OP)
  // ==========================================================================
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

  step(stepName: string, metadata?: Record<string, unknown>): void {}
  file(ref: string): void {}
  data(label: string, value: unknown): void {}
  preview(label: string, value: unknown): void {}
  prompt(model: string, content: string): void {}
}
