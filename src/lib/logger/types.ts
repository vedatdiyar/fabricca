export interface TokenUsage {
  input?: number;
  output?: number;
  total?: number;
}

export type ServiceName =
  | "gemini"
  | "cloudflare"
  | "thesis-search"
  | "db"
  | "auth"
  | "flow"
  | "matrix"
  | "complete"
  | "boxes"
  | "wikipedia"
  | "literature"
  | "library"
  | "openalex"
  | "crossref"
  | "dashboard"
  | "cohere"
  | "positioning"
  | "pdf-parser"
  | "rag-search"
  | "advisor"
  | "citation-cards"
  | "literature-matrix"
  | "outline"
  | "thesis-architecture"
  | "pipeline"
  | "timeline"
  | "onboarding"
  | "ui";

export interface LogParams {
  service?: ServiceName;
  step?: string;
  durationMs?: number;
  data?: Record<string, unknown>;
  error?: unknown;
  tokens?: TokenUsage;
  filePath?: string;
  status?: "START" | "SUCCESS" | "FAILED" | "RETRY";
  blank?: "after" | "before" | "none";
  silentStart?: boolean;
  hidden?: boolean;
}

export interface ScopedTimer {
  done(summary?: string): void;
  fail(error: unknown, summary?: string): void;
}

export interface LoggerInstance {
  flowId: string;
  lastTokens?: TokenUsage;
  lastPayloadPath?: string;
  info(arg1: string | Record<string, unknown>, params?: LogParams): void;
  error(arg1: string | Record<string, unknown>, params?: LogParams): void;
  warn(arg1: string | Record<string, unknown>, params?: LogParams): void;
  success(event: string, params?: LogParams): void;
  failed(event: string, params?: LogParams): void;
  retry(event: string, params?: LogParams): void;
  time<T>(event: string, fn: () => Promise<T>, params?: LogParams): Promise<T>;
  startTimer(event: string, params?: LogParams): ScopedTimer;
  saveDebugPayload?(
    s: string,
    m: string,
    p: string,
    r?: string,
  ): string | undefined;
  total(
    event: string,
    durationMs: number,
    p?: { service?: ServiceName; data?: Record<string, unknown> },
  ): void;
}
