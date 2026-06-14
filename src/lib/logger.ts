/**
 * Merkezi yapılandırılmış JSON log sistemi.
 *
 * Production'da tek satır JSON olarak terminale (stdout/stderr) yazılır.
 * Development'ta aynı JSON yapısı korunur ancak terminale chalk ile
 * görsel olarak zenginleştirilmiş çıktı basılır.
 *
 * Terminal debug için production kullanımı:
 *   grep '"flowId":"fl_xxx"'             → flow bazında filtreleme
 *   grep '"level":"error"'                → hata logları
 *   grep '"event":"ai_request_failed"'    → AI başarısızlıkları
 */

import { updateDevStats, renderVisual, clearDevFlow } from "./logger-dev";

export type LogLevel = "info" | "warn" | "error";

export type LogEvent =
  | "flow_start"
  | "flow_complete"
  | "ai_request_start"
  | "ai_request_success"
  | "ai_request_failed"
  | "ai_low_quality_response"
  | "ai_retry_attempt"
  | "ai_parse_failed_recovering"
  | "search_start"
  | "search_success"
  | "search_filtered"
  | "search_empty"
  | "db_start"
  | "db_success"
  | "db_failed"
  | "login_success"
  | "login_failed";

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

function toISOString(): string {
  return new Date().toISOString();
}

function truncateData(
  value: unknown,
  maxDepth = 3,
  maxStringLength = 300,
  maxArrayItems = 10,
): unknown {
  if (typeof value === "string") {
    if (value.length <= maxStringLength) return value;
    return value.substring(0, maxStringLength) + "...";
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  if (maxDepth <= 0) {
    if (Array.isArray(value)) return `[Array(${value.length})]`;
    return "{Object}";
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    const items = value
      .slice(0, maxArrayItems)
      .map((item) =>
        truncateData(item, maxDepth - 1, maxStringLength, maxArrayItems),
      );
    if (value.length > maxArrayItems) {
      items.push(`...${value.length - maxArrayItems} more`);
    }
    return items;
  }

  const result: Record<string, unknown> = {};
  const entries = Object.entries(value as Record<string, unknown>);
  for (const [key, val] of entries) {
    result[key] = truncateData(
      val,
      maxDepth - 1,
      maxStringLength,
      maxArrayItems,
    );
  }
  return result;
}

/**
 * Benzersiz bir flowId üretir.
 * Base36 timestamp + rastgele 6 karakter → çakışma olasılığı ihmal edilebilir.
 *
 * @returns fl_ ile başlayan benzersiz flow tanımlayıcısı
 */
export function createFlowId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `fl_${timestamp}_${random}`;
}

/**
 * Yapılandırılmış JSON logger.
 *
 * Her instance bir flowId'ye bağlanır ve tüm loglar
 * bu flowId altında terminale yazılır.
 *
 * @example
 *   const flowId = createFlowId();
 *   const log = new Logger(flowId);
 *   log.info("flow_start", { service: "matrix" });
 */
export class Logger {
  private readonly flowId: string;

  constructor(flowId: string) {
    this.flowId = flowId;
  }

  /**
   * Bilgi seviyesinde log yazar.
   *
   * @param event - Standartlaştırılmış event adı
   * @param params - Opsiyonel parametreler (service, step, durationMs, data)
   */
  info(event: LogEvent, params?: LogParams): void {
    this.write("info", event, params);
  }

  /**
   * Uyarı seviyesinde log yazar.
   *
   * @param event - Standartlaştırılmış event adı
   * @param params - Opsiyonel parametreler (service, step, durationMs, data)
   */
  warn(event: LogEvent, params?: LogParams): void {
    this.write("warn", event, params);
  }

  /**
   * Hata seviyesinde log yazar. Hata detayları ve token bilgisi içerebilir.
   *
   * @param event - Standartlaştırılmış event adı
   * @param params - Opsiyonel parametreler (service, step, durationMs, data, error, tokens)
   */
  error(event: LogEvent, params?: LogParams): void {
    this.write("error", event, params);
  }

  private write(level: LogLevel, event: LogEvent, params?: LogParams): void {
    const isDevelopment = process.env.NODE_ENV === "development";

    // --- Build structured JSON entry (always, for production) ---
    const entry: Record<string, unknown> = {
      timestamp: toISOString(),
      level,
      event,
      flowId: this.flowId,
      service: params?.service ?? "flow",
    };

    if (params?.step) entry.step = params.step;
    if (params?.durationMs !== undefined)
      entry.durationMs = Math.round(params.durationMs);
    if (params?.data) entry.data = truncateData(params.data);
    if (params?.tokens) entry.tokens = params.tokens;

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
        (entry.error as Record<string, string>).stack = err.stack;
      }
    }

    const line = JSON.stringify(entry);

    // --- Production path (Leak Guard: never touch devStats) ---
    if (!isDevelopment) {
      switch (level) {
        case "info":
          console.log(line);
          break;
        case "warn":
          console.warn(line);
          break;
        case "error":
          console.error(line);
          break;
      }
      return;
    }

    // --- Development path ---
    updateDevStats(this.flowId, level, event, params);

    const visual = renderVisual(this.flowId, level, event, params);
    if (visual) {
      switch (level) {
        case "info":
          console.log(visual);
          break;
        case "warn":
          console.warn(visual);
          break;
        case "error":
          console.error(visual);
          break;
      }
    }

    // --- Memory cleanup on final flow_complete ---
    if (event === "flow_complete" && !params?.step) {
      clearDevFlow(this.flowId);
    }
  }
}
