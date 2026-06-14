import pino from "pino";
import pretty from "pino-pretty";

export type LogLevel = "info" | "warn" | "error";

export type LogEvent =
  | "login_success"
  | "login_failed"
  | "flow_complete";

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
  | "wikipedia";

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

  info(arg1: string | Record<string, any>, params?: LogParams): void {
    this.write("info", arg1, params);
  }

  warn(arg1: string | Record<string, any>, params?: LogParams): void {
    this.write("warn", arg1, params);
  }

  error(arg1: string | Record<string, any>, params?: LogParams): void {
    this.write("error", arg1, params);
  }

  private write(
    level: "info" | "warn" | "error",
    arg1: string | Record<string, any>,
    params?: LogParams,
  ): void {
    if (typeof arg1 === "object" && arg1 !== null) {
      // Structured logging object (new format)
      const entry = {
        flowId: this.flowId,
        ...arg1,
      };
      pinoLogger[level](entry);
    } else {
      // Event-based logging string (legacy compatibility)
      const event = arg1 as string;
      const entry: Record<string, any> = {
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

      // Track last token count from ai success messages globally on the Logger instance
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
          entry.error.stack = err.stack;
        }
      }

      pinoLogger[level](entry);
    }
  }
}
