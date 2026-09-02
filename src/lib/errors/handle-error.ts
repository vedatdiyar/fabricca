import { z } from "zod";
import { Logger, createFlowId } from "@/lib/logger";
import { AppError, ValidationError, type QuotaType } from "./app-error";
import { isDailyQuotaExceeded } from "@/lib/rate-limiter";

export interface ActionErrorResult {
  success: false;
  error: string;
  code: string;
  quotaType?: QuotaType;
  retryAfterMs?: number;
  resetsAt?: string;
  meta?: Record<string, unknown>;
}

/**
 * Computes Pacific midnight ISO for DailyQuotaExceededError fallback.
 */
function getPacificMidnightResetISOFallback(): string {
  const ptDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [yStr, mStr, dStr] = ptDateStr.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const nextD = d === new Date(y, m, 0).getDate() ? 1 : d + 1;
  const nextM = d === new Date(y, m, 0).getDate() ? (m % 12) + 1 : m;
  const nextY = m === 12 && d === 31 ? y + 1 : y;
  const isPDT = (() => {
    const secondSundayMarch = (() => {
      const first = new Date(Date.UTC(nextY, 2, 1));
      return 1 + ((7 - first.getUTCDay()) % 7) + 7;
    })();
    const firstSundayNov = (() => {
      const first = new Date(Date.UTC(nextY, 10, 1));
      return 1 + ((7 - first.getUTCDay()) % 7);
    })();
    if (nextM > 3 && nextM < 11) return true;
    if (nextM < 3 || nextM > 11) return false;
    if (nextM === 3) return nextD >= secondSundayMarch;
    return nextD < firstSundayNov;
  })();
  return new Date(Date.UTC(nextY, nextM - 1, nextD, isPDT ? 7 : 8, 0, 0)).toISOString();
}

const UNEXPECTED_MESSAGE =
  "Beklenmeyen bir sistem hatası oluştu. Lütfen tekrar deneyiniz.";

/**
 * Normalizes any thrown value into the standard `{ success: false }` shape
 * every server action returns, and logs it through the central Logger.
 *
 * - `AppError` instances keep their userMessage and code; operational errors
 *   are logged at warn level, non-operational ones at error level.
 * - `z.ZodError` instances are wrapped into a `ValidationError` and their
 *   first issue message (or a Turkish default) is surfaced to the user.
 * - Any other value is treated as an unexpected system error: technical
 *   details are logged at error level but the user only receives a generic
 *   Turkish message.
 *
 * @param error - The thrown value to handle.
 * @param logger - Optional logger instance; when omitted a fresh flow logger is created.
 * @returns The standard action error result.
 */
export function handleActionError(
  error: unknown,
  logger?: Logger,
): ActionErrorResult {
  const log = logger ?? new Logger(createFlowId());

  if (isDailyQuotaExceeded(error)) {
    const resetsAt = getPacificMidnightResetISOFallback();
    const label = (error as { label?: string }).label ?? "unknown";
    log.warn("action_daily_quota_exceeded", {
      data: { code: "AI_PROVIDER_ERROR", label, resetsAt, quotaType: "RPD" as const },
      error,
    });
    return {
      success: false,
      error: "Yapay zeka hizmetinin günlük kullanım kotası doldu. Kota Pasifik saatiyle gece yarısı sıfırlanacak. Lütfen yarın tekrar deneyin.",
      code: "AI_PROVIDER_ERROR",
      quotaType: "RPD",
      resetsAt,
      meta: { label },
    };
  }

  if (error instanceof AppError) {
    const payload = {
      data: {
        code: error.code,
        statusCode: error.statusCode,
        quotaType: error.quotaType,
        retryAfterMs: error.retryAfterMs,
        resetsAt: error.resetsAt,
      },
      error,
    };
    if (error.isOperational) {
      log.warn("action_operational_error", payload);
    } else {
      log.error("action_system_error", payload);
    }
    return {
      success: false,
      error: error.userMessage,
      code: error.code,
      ...(error.quotaType ? { quotaType: error.quotaType } : {}),
      ...(error.retryAfterMs !== undefined ? { retryAfterMs: error.retryAfterMs } : {}),
      ...(error.resetsAt ? { resetsAt: error.resetsAt } : {}),
      ...(error.meta ? { meta: error.meta } : {}),
    };
  }

  if (error instanceof z.ZodError) {
    const validationError = new ValidationError({
      cause: error,
      userMessage: error.issues[0]?.message,
    });
    log.warn("action_validation_error", {
      data: { code: validationError.code, issueCount: error.issues.length },
      error: validationError,
    });
    return {
      success: false,
      error: validationError.userMessage,
      code: validationError.code,
    };
  }

  const technical = error instanceof Error ? error.message : String(error);
  log.error("action_unexpected_error", {
    data: { message: technical },
    error,
  });
  return { success: false, error: UNEXPECTED_MESSAGE, code: "INTERNAL_ERROR" };
}
