/**
 * Temel Logger sinifi ve createFlowId yardimcisi.
 * Logger tipi, konsola biçimlendirilmis log yazmak için kullanilir.
 * Dosya I/O (payload) ve konsol filtreleme ayri modüllerdedir.
 */

import {
  type LogParams,
  type TokenUsage,
  CONSOLE_METHOD,
  buildPrefix,
  buildSuffix,
  deriveStatus,
  getActionDisplay,
  peekStarted,
  markStarted,
  serializeError,
  renderDevLine,
  truncate,
} from "./formatter";
import { writePayloadFile } from "./payload-writer";

export interface LoggerInstance {
  flowId: string;
  lastTokens?: TokenUsage;
  lastPayloadPath?: string;
  info(arg1: string | Record<string, unknown>, params?: LogParams): void;
  warn(arg1: string | Record<string, unknown>, params?: LogParams): void;
  error(arg1: string | Record<string, unknown>, params?: LogParams): void;
  step(stepName: string, _metadata?: Record<string, unknown>): void;
  file(ref: string): void;
  data(label: string, value: unknown): void;
  preview(label: string, value: unknown): void;
  prompt(model: string, content: string): void;
  saveDebugPayload(
    stage: string,
    module: string,
    prompt: string,
    response?: string,
  ): string | undefined;
}

export class Logger implements LoggerInstance {
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
    if (process.env.NODE_ENV !== "development") return;
    void _metadata;
    const actDisplay = getActionDisplay("step");
    const prefix = buildPrefix("flow", "SUCCESS", actDisplay.label);
    console.log(`${prefix}  ${stepName}`);
  }

  file(ref: string): void {
    if (process.env.NODE_ENV !== "development") return;
    const actDisplay = getActionDisplay("file_ref");
    const prefix = buildPrefix("flow", "SUCCESS", actDisplay.label);
    console.log(`${prefix}  ${ref}`);
  }

  data(label: string, value: unknown): void {
    if (process.env.NODE_ENV !== "development") return;
    const actDisplay = getActionDisplay("data");
    const prefix = buildPrefix("flow", "SUCCESS", actDisplay.label);
    const display =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    console.log(`${prefix}  ${label}: ${truncate(display, 100)}`);
  }

  preview(label: string, value: unknown): void {
    if (process.env.NODE_ENV !== "development") return;
    const actDisplay = getActionDisplay("preview");
    const prefix = buildPrefix("flow", "SUCCESS", actDisplay.label);
    const raw =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    console.log(`${prefix}  ${label}: ${truncate(raw, 120)}`);
  }

  prompt(model: string, content: string): void {
    if (process.env.NODE_ENV !== "development") return;
    const actDisplay = getActionDisplay("ai_prompt");
    const prefix = buildPrefix("gemini", "SUCCESS", actDisplay.label);
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
    const filePath = writePayloadFile(
      this.flowId,
      stage,
      module,
      prompt,
      response,
    );
    if (filePath) {
      this.lastPayloadPath = filePath;
    }
    return filePath;
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

      if (process.env.NODE_ENV === "development") {
        console.log(renderDevLine(entry));
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

    if (process.env.NODE_ENV === "development") {
      const actDisplay = getActionDisplay(event);
      const prefix = buildPrefix(service, status, actDisplay.label);
      const suffix = buildSuffix(params);
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
}

/**
 * Benzersiz bir flow ID üretir.
 * Zaman damgasi (base36) + rastgele 6 karakter.
 * @returns fl_ formatinda flow ID
 *
 * @example
 *   createFlowId() // "fl_m1x2a3_b4c5d6"
 */
export function createFlowId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `fl_${timestamp}_${random}`;
}
