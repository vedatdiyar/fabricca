import pino from "pino";
import pretty from "pino-pretty";

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
}

const isDevelopment = process.env.NODE_ENV === "development";

const BOX_W = (() => {
  try {
    return Math.min(process.stdout.columns ?? 100, 98);
  } catch {
    return 80;
  }
})();

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
 *
 * @returns fl_ ile başlayan benzersiz flow tanımlayıcısı
 */
export function createFlowId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `fl_${timestamp}_${random}`;
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
      if (isDevelopment) {
        this.renderDevBox(level, entry);
      } else {
        pinoLogger[level](entry);
      }
    } else {
      const event = arg1 as string;
      const entry: Record<string, unknown> = {
        event,
        flowId: this.flowId,
        service: params?.service ?? "flow",
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

      pinoLogger[level](entry);
    }
  }

  // ==========================================================================
  // Dev-Only Visualization Methods (no-ops in production)
  // ==========================================================================

  /**
   * @param stepName - Step name.
   * @param metadata - Optional key/value data.
   */
  step(stepName: string, metadata?: Record<string, unknown>): void {
    if (!isDevelopment) return;
    this.renderDevBox("info", {
      step: stepName,
      status: metadata ? undefined : "TRACE",
      flowId: this.flowId,
      ...metadata,
    });
  }

  /**
   * @param ref - File path with line number (e.g. "queries.ts:42").
   */
  file(ref: string): void {
    if (!isDevelopment) return;
    this.renderLabelBox("📂 KOD DOSYASI", ref);
  }

  /**
   * @param label - Data label.
   * @param value - Data value to preview.
   */
  data(label: string, value: unknown): void {
    if (!isDevelopment) return;
    this.renderDataBox(label, value);
  }

  /**
   * @param label - Preview label.
   * @param value - Value to preview.
   */
  preview(label: string, value: unknown): void {
    this.data(label, value);
  }

  /**
   * @param model - Model name.
   * @param content - Full prompt text.
   */
  prompt(model: string, content: string): void {
    if (!isDevelopment) return;
    this.renderPromptBox(model, content);
  }

  // ==========================================================================
  // Box Renderers (dev only)
  // ==========================================================================

  private renderDevBox(level: string, data: Record<string, unknown>): void {
    const step = String(data.step ?? "unknown");
    const status = data.status ? String(data.status) : "";
    const flowId = String(data.flowId ?? "");

    let icon = "\u{1F7E6}";
    if (level === "error" || status === "FAILED") icon = "\u274C";
    else if (status === "START") icon = "\u{1F680}";
    else if (level === "warn") icon = "\u26A0\uFE0F";
    else if (status === "SUCCESS") icon = "\u2705";
    else if (status === "TRACE") icon = "\u{1F9F1}";

    const title =
      status && status !== "TRACE" ? `${step} \u203A ${status}` : step;

    const flowTag = flowId ? ` \u{1F517} ${flowId}` : "";
    const titleLine = `${icon} ${title}${flowTag}`;

    this.printBox([titleLine]);

    if (data.metrics && typeof data.metrics === "object") {
      const m = data.metrics as Record<string, unknown>;
      const parts: string[] = [];
      if (m.duration) parts.push(`\u23F1 ${m.duration}`);
      if (m.tokens && typeof m.tokens === "object") {
        const t = m.tokens as Record<string, unknown>;
        parts.push(
          `\u{1F538}${t.prompt ?? "?"} \u{1F539}${t.completion ?? "?"}`,
        );
      }
      if (m.outputRows !== undefined) parts.push(`\u{1F4C4} ${m.outputRows}`);
      if (parts.length > 0) {
        this.printBox([parts.join("  \u2502  ")]);
      }
    }

    if (data.diagnostics && typeof data.diagnostics === "object") {
      const d = data.diagnostics as Record<string, unknown>;
      for (const [dk, dv] of Object.entries(d)) {
        if (dv === undefined || dv === null) continue;
        this.printBox([`\u{1F4CA} ${dk}: ${this.shorten(String(dv), 60)}`]);
      }
    }

    for (const key of Object.keys(data)) {
      if (["step", "status", "flowId", "metrics", "diagnostics"].includes(key))
        continue;
      const value = data[key];
      if (value === undefined || value === null) continue;
      this.printBox([
        `\u{1F4CA} ${key}: ${this.shorten(JSON.stringify(value), 60)}`,
      ]);
    }
  }

  private renderLabelBox(label: string, content: string): void {
    this.printBox([`${label}  ${content}`]);
  }

  private renderDataBox(label: string, value: unknown): void {
    const formatted =
      typeof value === "string" ? value : JSON.stringify(value, null, 2);
    const lines = formatted.split("\n").slice(0, 15);
    if (lines.length < formatted.split("\n").length) {
      lines.push(`... (${formatted.split("\n").length - 15} more lines)`);
    }
    const header = `\u{1F4CA} ${label}`;
    this.printBox([header, ...lines.map((l) => `  ${l}`)]);
  }

  private renderPromptBox(model: string, content: string): void {
    const lines = content.split("\n");
    const maxLines = 25;
    const display = lines.slice(0, maxLines);
    if (lines.length > maxLines) {
      display.push(`... (${lines.length - maxLines} more lines)`);
    }
    const header = `\u{1F9D9} Prompt \u203A ${model}`;
    this.printBox([header, ...display.map((l) => `  ${l}`)]);
  }

  private printBox(lines: string[]): void {
    const innerW = BOX_W - 4;
    const hRule = "\u2550".repeat(BOX_W - 2);
    console.log(`\u2554${hRule}\u2557`);
    for (const line of lines) {
      const clipped =
        line.length > innerW ? line.slice(0, innerW - 3) + "..." : line;
      const pad = innerW - clipped.length;
      console.log(`\u2551  ${clipped}${" ".repeat(pad < 0 ? 0 : pad)}\u2551`);
    }
    console.log(`\u255A${hRule}\u255D`);
  }

  private shorten(s: string, maxLen: number): string {
    if (s.length <= maxLen) return s;
    return s.slice(0, Math.max(0, maxLen - 3)) + "...";
  }
}
