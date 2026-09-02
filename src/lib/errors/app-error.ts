export type ErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "FORBIDDEN_ERROR"
  | "NOT_FOUND"
  | "DATABASE_ERROR"
  | "AI_PROVIDER_ERROR"
  | "STORAGE_ERROR"
  | "EXTERNAL_API_ERROR"
  | "INTERNAL_ERROR";

export type QuotaType = "RPM" | "RPD" | "CONCURRENCY";

export interface AppErrorInput {
  /** Stable machine-readable error identifier. */
  code?: ErrorCode;
  /** Internal, technical message (English). Never shown to the user directly. */
  message?: string;
  /** User-facing Turkish message shown in the UI. */
  userMessage?: string;
  /** The original error that caused this error, kept for diagnostics. */
  cause?: unknown;
  /** Additional diagnostic context, never exposed to the user. */
  technicalDetails?: unknown;
  /** When false the error is unexpected and must be logged at error level. */
  isOperational?: boolean;
  /** Optional HTTP status override (e.g. AiProviderError 502 vs 503). */
  statusCode?: number;
  /** Quota kind extracted from provider error (RPM per-minute vs RPD per-day). */
  quotaType?: QuotaType;
  /** Recommended retry delay in milliseconds (from RetryInfo / Retry-After). */
  retryAfterMs?: number;
  /** ISO-8601 timestamp when quota resets (Pacific midnight for RPD, now+retryAfter for RPM). */
  resetsAt?: string;
  /** Arbitrary structured metadata forwarded to the client (lossless quota details). */
  meta?: Record<string, unknown>;
}

/**
 * Base class for every application error in the system.
 *
 * Carries the fields the UI and API layers need to respond consistently:
 * a stable machine-readable `code`, an HTTP `statusCode`, an
 * `isOperational` flag separating expected from unexpected failures, and a
 * `userMessage` never exposing technical details.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly userMessage: string;
  public readonly technicalDetails: unknown;
  public readonly quotaType?: QuotaType;
  public readonly retryAfterMs?: number;
  public readonly resetsAt?: string;
  public readonly meta?: Record<string, unknown>;

  constructor(input: AppErrorInput) {
    super(input.message ?? "Application error.");
    this.name = "AppError";
    this.code = input.code ?? "INTERNAL_ERROR";
    this.statusCode = input.statusCode ?? 500;
    this.isOperational = input.isOperational ?? true;
    this.userMessage =
      input.userMessage ?? "Bir hata oluştu. Lütfen tekrar deneyin.";
    this.technicalDetails = input.technicalDetails ?? input.cause;
    this.quotaType = input.quotaType;
    this.retryAfterMs = input.retryAfterMs;
    this.resetsAt = input.resetsAt;
    this.meta = input.meta;
    if (input.cause !== undefined) {
      this.cause = input.cause;
    }
  }
}

/**
 * Error raised when submitted data fails validation (Zod or business rules).
 */
export class ValidationError extends AppError {
  constructor(input: AppErrorInput = {}) {
    super({
      message: input.message ?? "Validation failed.",
      userMessage:
        input.userMessage ??
        "Gönderilen veriler doğrulanamadı. Lütfen bilgilerinizi kontrol edin.",
      statusCode: input.statusCode ?? 400,
      code: "VALIDATION_ERROR",
      isOperational: input.isOperational ?? true,
      cause: input.cause,
      technicalDetails: input.technicalDetails,
      quotaType: input.quotaType,
      retryAfterMs: input.retryAfterMs,
      resetsAt: input.resetsAt,
      meta: input.meta,
    });
    this.name = "ValidationError";
  }
}

/**
 * Error raised when there is no valid active session.
 */
export class AuthenticationError extends AppError {
  constructor(input: AppErrorInput = {}) {
    super({
      message: input.message ?? "Authentication required.",
      userMessage:
        input.userMessage ?? "Oturumunuz sona erdi. Lütfen tekrar giriş yapın.",
      statusCode: input.statusCode ?? 401,
      code: "AUTHENTICATION_ERROR",
      isOperational: input.isOperational ?? true,
      cause: input.cause,
      technicalDetails: input.technicalDetails,
      quotaType: input.quotaType,
      retryAfterMs: input.retryAfterMs,
      resetsAt: input.resetsAt,
      meta: input.meta,
    });
    this.name = "AuthenticationError";
  }
}

/**
 * Error raised when an authenticated user attempts an unauthorized operation.
 */
export class ForbiddenError extends AppError {
  constructor(input: AppErrorInput = {}) {
    super({
      message: input.message ?? "Access denied.",
      userMessage:
        input.userMessage ??
        "Bu işlemi gerçekleştirmek için yetkiniz bulunmuyor.",
      statusCode: input.statusCode ?? 403,
      code: "FORBIDDEN_ERROR",
      isOperational: input.isOperational ?? true,
      cause: input.cause,
      technicalDetails: input.technicalDetails,
      quotaType: input.quotaType,
      retryAfterMs: input.retryAfterMs,
      resetsAt: input.resetsAt,
      meta: input.meta,
    });
    this.name = "ForbiddenError";
  }
}

/**
 * Error raised when a requested resource does not exist.
 */
export class NotFoundError extends AppError {
  constructor(input: AppErrorInput = {}) {
    super({
      message: input.message ?? "Resource not found.",
      userMessage: input.userMessage ?? "Aradığınız kaynak bulunamadı.",
      statusCode: input.statusCode ?? 404,
      code: "NOT_FOUND",
      isOperational: input.isOperational ?? true,
      cause: input.cause,
      technicalDetails: input.technicalDetails,
      quotaType: input.quotaType,
      retryAfterMs: input.retryAfterMs,
      resetsAt: input.resetsAt,
      meta: input.meta,
    });
    this.name = "NotFoundError";
  }
}

/**
 * Error raised when a database operation fails.
 */
export class DatabaseError extends AppError {
  constructor(input: AppErrorInput = {}) {
    super({
      message: input.message ?? "Database operation failed.",
      userMessage:
        input.userMessage ??
        "Veritabanı işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.",
      statusCode: input.statusCode ?? 500,
      code: "DATABASE_ERROR",
      isOperational: input.isOperational ?? true,
      cause: input.cause,
      technicalDetails: input.technicalDetails,
      quotaType: input.quotaType,
      retryAfterMs: input.retryAfterMs,
      resetsAt: input.resetsAt,
      meta: input.meta,
    });
    this.name = "DatabaseError";
  }
}

/**
 * Error raised when an LLM / AI provider fails or is unavailable.
 */
export class AiProviderError extends AppError {
  constructor(input: AppErrorInput = {}) {
    super({
      message: input.message ?? "AI provider request failed.",
      userMessage:
        input.userMessage ??
        "Yapay zeka hizmeti şu anda yanıt veremiyor. Lütfen daha sonra tekrar deneyin.",
      statusCode: input.statusCode ?? 503,
      code: "AI_PROVIDER_ERROR",
      isOperational: input.isOperational ?? true,
      cause: input.cause,
      technicalDetails: input.technicalDetails,
      quotaType: input.quotaType,
      retryAfterMs: input.retryAfterMs,
      resetsAt: input.resetsAt,
      meta: input.meta,
    });
    this.name = "AiProviderError";
  }
}

/**
 * Error raised when object storage (Cloudflare R2) or PDF storage fails.
 */
export class StorageError extends AppError {
  constructor(input: AppErrorInput = {}) {
    super({
      message: input.message ?? "Object storage operation failed.",
      userMessage:
        input.userMessage ??
        "Dosya depolama hizmetiyle ilgili bir sorun oluştu. Lütfen tekrar deneyin.",
      statusCode: input.statusCode ?? 500,
      code: "STORAGE_ERROR",
      isOperational: input.isOperational ?? true,
      cause: input.cause,
      technicalDetails: input.technicalDetails,
      quotaType: input.quotaType,
      retryAfterMs: input.retryAfterMs,
      resetsAt: input.resetsAt,
      meta: input.meta,
    });
    this.name = "StorageError";
  }
}

/**
 * Error raised when an external API (OpenAlex, Crossref, etc.) fails.
 */
export class ExternalApiError extends AppError {
  constructor(input: AppErrorInput = {}) {
    super({
      message: input.message ?? "External API request failed.",
      userMessage:
        input.userMessage ??
        "Dış akademik kaynak şu anda yanıt vermiyor. Lütfen tekrar deneyin.",
      statusCode: input.statusCode ?? 502,
      code: "EXTERNAL_API_ERROR",
      isOperational: input.isOperational ?? true,
      cause: input.cause,
      technicalDetails: input.technicalDetails,
      quotaType: input.quotaType,
      retryAfterMs: input.retryAfterMs,
      resetsAt: input.resetsAt,
      meta: input.meta,
    });
    this.name = "ExternalApiError";
  }
}
