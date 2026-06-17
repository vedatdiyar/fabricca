import pino from "pino";
import pretty from "pino-pretty";
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

export interface LogParams {
  service?: ServiceName;
  step?: string;
  durationMs?: number;
  data?: Record<string, unknown>;
  error?: unknown;
  tokens?: TokenUsage;
  filePath?: string;
  status?: "PENDING" | "SUCCESS" | "FAILED";
}

const isDevelopment = process.env.NODE_ENV === "development";

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
 * Benzersiz bir flowId üretir.
 * Base36 timestamp + rastgele 6 karakter.
 */
export function createFlowId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `fl_${timestamp}_${random}`;
}

const SERVICE_ICONS: Record<ServiceName, string> = {
  gemini: "🤖",
  cloudflare: "☁️",
  tavily: "🌐",
  tezara: "🔎",
  db: "🗄️",
  auth: "🔐",
  flow: "📌",
  matrix: "📋",
  enrichment: "✨",
  originality: "⚖️",
  complete: "✅",
  boxes: "📦",
  wikipedia: "📖",
  literature: "📚",
  library: "📖",
  openalex: "🔬",
  crossref: "🔗",
};

function getServiceIcon(service: ServiceName): string {
  return SERVICE_ICONS[service] ?? "📌";
}

function getStatusTag(status: string): string {
  switch (status) {
    case "SUCCESS":
      return "\x1b[32m🟢 SUCCESS\x1b[0m";
    case "FAILED":
      return "\x1b[31m🔴 FAILED\x1b[0m";
    case "PENDING":
    case "START":
    case "RETRYING":
      return "\x1b[33m🟡 PENDING\x1b[0m";
    default:
      return status;
  }
}

function deriveStatus(event: string): string {
  if (event.endsWith("_start") || event.endsWith("_attempt")) return "PENDING";
  if (event.endsWith("_success")) return "SUCCESS";
  if (event.endsWith("_failed") || event.endsWith("_filtered") || event.endsWith("_empty"))
    return "FAILED";
  return "PENDING";
}

function truncate(s: string, maxLen: number): string {
  return s.length <= maxLen ? s : s.slice(0, maxLen - 3) + "...";
}

export class Logger {
  public readonly flowId: string;
  public lastTokens?: TokenUsage;

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
      const entry = { flowId: this.flowId, ...arg1 };
      if (isDevelopment) this.renderDevLine(entry);
      pinoLogger[level](entry);
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

      if (isDevelopment) {
        const status = params?.status ?? deriveStatus(event);
        this.renderEventLine(service, event, status, params);
      }

      pinoLogger[level](entry);
    }
  }

  // ==========================================================================
  // Dev-Only Single-Line Renderers
  // ==========================================================================

  private renderEventLine(
    service: ServiceName,
    event: string,
    status: string,
    params?: LogParams,
  ): void {
    const icon = getServiceIcon(service);
    const statusTag = getStatusTag(status);
    const line = this.buildLine(icon, service, event, statusTag, params);
    console.log(line);
  }

  private renderDevLine(data: Record<string, unknown>): void {
    const step = String(data.step ?? "unknown");
    const svc = String(data.service ?? "flow");
    const rawStatus = data.status ? String(data.status) : "";
    const icon = getServiceIcon(svc as ServiceName);
    const statusTag = rawStatus ? getStatusTag(rawStatus) : "";

    let line = `${icon} ${this.flowId} [${svc.toUpperCase()}] -> ${step}`;
    if (statusTag) line += ` | ${statusTag}`;

    const metrics = data.metrics as Record<string, unknown> | undefined;
    if (metrics) {
      const durMs = metrics.durationMs as number | undefined;
      const dur = metrics.duration as string | undefined;
      if (durMs !== undefined && typeof durMs === "number") line += ` | ⏱️ ${Math.round(durMs)}ms`;
      else if (dur) line += ` | ⏱️ ${dur}`;
    }

    const extraData = data.data as Record<string, unknown> | undefined;
    if (extraData) {
      const parts: string[] = [];
      if (extraData.count !== undefined) parts.push(`📊 Sayı: ${extraData.count}`);
      if (extraData.resultCount !== undefined) parts.push(`📊 ${extraData.resultCount} sonuç`);
      if (extraData.model) parts.push(`🏷️ Model: ${extraData.model}`);
      if (extraData.query) parts.push(`🔍 ${truncate(String(extraData.query), 60)}`);
      if (parts.length > 0) line += ` | ${parts.join(" | ")}`;
    }

    const diagnostics = data.diagnostics as Record<string, unknown> | undefined;
    if (diagnostics) {
      const msg = diagnostics.message ? String(diagnostics.message) : "";
      if (msg) line += ` | ❌ ${truncate(msg, 120)}`;
    }

    const err = data.error as { message?: string } | undefined;
    if (err && err.message && !diagnostics) {
      line += ` | ❌ ${truncate(err.message, 120)}`;
    }

    console.log(line);
  }

  private buildLine(
    icon: string,
    service: ServiceName,
    event: string,
    statusTag: string,
    params?: LogParams,
  ): string {
    const adim = params?.step && params.step !== event ? `${event} (${params.step})` : event;
    let line = `${icon} ${this.flowId} [${service.toUpperCase()}] -> ${adim} | ${statusTag}`;

    if (params?.durationMs !== undefined) {
      line += ` | ⏱️ ${Math.round(params.durationMs)}ms`;
    }

    if (params?.filePath) {
      const cleanPath = params.filePath.replace(/^src\//, "");
      line += ` | 📁 ${cleanPath}`;
    }

    if (params?.data?.model && params?.tokens) {
      const t = params.tokens;
      line += ` | 🏷️ [Model: ${params.data.model} | 📥 In: ${t.input ?? "?"} | 📤 Out: ${t.output ?? "?"}`;
      if (t.total !== undefined) line += ` | 💭 ${t.total} tkn`;
      line += `]`;
    } else {
      if (params?.data?.model) {
        line += ` | 🏷️ Model: ${params.data.model}`;
      }
      if (params?.tokens) {
        const t = params.tokens;
        line += ` | 📥 In: ${t.input ?? "?"} | 📤 Out: ${t.output ?? "?"}`;
        if (t.total !== undefined) line += ` | 💭 ${t.total} tkn`;
      }
    }

    if (params?.data && !params.data.model) {
      const parts: string[] = [];
      const d = params.data;
      if (d.query) parts.push(`🔍 ${truncate(String(d.query), 60)}`);
      if (d.resultCount !== undefined) parts.push(`📊 ${d.resultCount} sonuç`);
      if (d.count !== undefined) parts.push(`📊 Sayı: ${d.count}`);
      if (d.rawCount !== undefined) parts.push(`🔢 Ham: ${d.rawCount}`);
      if (d.mergedCount !== undefined) parts.push(`🔀 Birleşik: ${d.mergedCount}`);
      if (d.before !== undefined && d.after !== undefined) parts.push(`${d.before} → ${d.after}`);
      if (d.totalResults !== undefined) parts.push(`📊 Toplam: ${d.totalResults}`);
      if (d.reason) parts.push(`📝 ${truncate(String(d.reason), 80)}`);
      if (d.starterPackCount !== undefined) parts.push(`📦 Starter: ${d.starterPackCount}`);
      if (d.reservedPoolCount !== undefined) parts.push(`📦 Reserved: ${d.reservedPoolCount}`);
      if (d.enrichedCount !== undefined) parts.push(`🔗 Zenginleştirilen: ${d.enrichedCount}`);
      if (d.requestedCount !== undefined) parts.push(`🔢 İstenen: ${d.requestedCount}`);
      if (d.resolvedCount !== undefined) parts.push(`✅ Çözülen: ${d.resolvedCount}`);
      if (d.status) parts.push(`🌐 HTTP ${d.status}`);
      if (d.errorCode) parts.push(`❌ ${d.errorCode}`);
      if (parts.length > 0) line += ` | ${parts.join(" | ")}`;
    }

    if (params?.error) {
      const err = params.error;
      const display = getErrorDisplay(err);
      const scenario = classifyError(err);
      line += ` | ❌ [${scenario.toUpperCase()}] ${display.title}`;
    }

    return line;
  }

  // ==========================================================================
  // Dev-Only Helper Methods (no-ops in production)
  // ==========================================================================

  /**
   * Dev modunda adım takibi için tek satır.
   */
  step(stepName: string, metadata?: Record<string, unknown>): void {
    if (!isDevelopment) return;
    const meta = metadata ? ` | ${JSON.stringify(metadata)}` : "";
    console.log(`📌 ${this.flowId} ${stepName}${meta}`);
  }

  /**
   * Dev modunda dosya referansını tek satırda basar.
   */
  file(ref: string): void {
    if (!isDevelopment) return;
    console.log(`📂 ${this.flowId} ${ref}`);
  }

  /**
   * Dev modunda veriyi tek satırda gösterir.
   */
  data(label: string, value: unknown): void {
    if (!isDevelopment) return;
    const formatted =
      typeof value === "string" ? value : JSON.stringify(value);
    const truncated =
      formatted.length > 120 ? formatted.slice(0, 117) + "..." : formatted;
    console.log(`📊 ${this.flowId} ${label}: ${truncated}`);
  }

  /**
   * data() alias'ı.
   */
  preview(label: string, value: unknown): void {
    this.data(label, value);
  }

  /**
   * Dev modunda prompt içeriğini özet olarak basar.
   */
  prompt(model: string, content: string): void {
    if (!isDevelopment) return;
    const preview = content.slice(0, 100).replace(/\n/g, " ");
    const suffix = content.length > 100 ? "..." : "";
    console.log(`🧠 ${this.flowId} Prompt > ${model}: ${preview}${suffix}`);
  }
}
