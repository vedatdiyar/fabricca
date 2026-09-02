import { AiProviderError, type QuotaType } from "@/lib/errors/app-error";
import {
  classifyError,
  type ErrorScenario,
  isRateLimitError,
  isRpdError,
} from "./error-classifier";
import { extractHttpStatus, extractRetryDelayMs } from "./llm-errors";
import { extractQuotaDetails } from "./quota-parser";

export const TURKISH_ERROR_BY_SCENARIO: Record<ErrorScenario, string> = {
  quota:
    "Yapay zeka hizmetinin anlık kullanım limitine ulaşıldı. Lütfen birkaç dakika sonra tekrar deneyin.",
  network:
    "Yapay zeka hizmetine bağlanılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.",
  system:
    "Yapay zeka hizmeti şu anda yanıt veremiyor. Lütfen daha sonra tekrar deneyin.",
};

/**
 * Computes Pacific midnight (America/Los_Angeles) as ISO-8601 string for RPD resets.
 * RPD quotas reset at 00:00 Pacific, so we compute the next occurrence.
 * Uses DST-aware offset (PDT UTC-7 vs PST UTC-8) derived from second Sunday in March
 * to first Sunday in November.
 */
function getPacificMidnightResetISO(from: Date = new Date()): string {
  const ptDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(from);
  const [yStr, mStr, dStr] = ptDateStr.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);

  // Next PT day at 00:00 wall time
  const nextY = m === 12 && d === 31 ? y + 1 : y;
  const nextM = m === 12 && d === 31 ? 1 : d === new Date(y, m, 0).getDate() ? (m % 12) + 1 : m;
  const nextD = d === new Date(y, m, 0).getDate() ? 1 : d + 1;

  // Determine if next PT midnight falls in PDT (DST) period.
  // DST: second Sunday in March 02:00 PT → first Sunday in November 02:00 PT.
  const isPDT = (year: number, month: number, day: number): boolean => {
    const secondSundayMarch = (() => {
      const first = new Date(Date.UTC(year, 2, 1));
      const dayOfWeek = first.getUTCDay(); // 0=Sun
      const offset = (7 - dayOfWeek) % 7;
      return 1 + offset + 7; // second Sunday
    })();
    const firstSundayNov = (() => {
      const first = new Date(Date.UTC(year, 10, 1));
      const dayOfWeek = first.getUTCDay();
      const offset = (7 - dayOfWeek) % 7;
      return 1 + offset;
    })();
    if (month > 3 && month < 11) return true;
    if (month < 3 || month > 11) return false;
    if (month === 3) return day >= secondSundayMarch;
    return day < firstSundayNov; // November
  };

  const pdt = isPDT(nextY, nextM, nextD);
  const offsetHours = pdt ? 7 : 8; // midnight PT = 07:00 UTC (PDT) or 08:00 UTC (PST)
  return new Date(Date.UTC(nextY, nextM - 1, nextD, offsetHours, 0, 0)).toISOString();
}

/**
 * Derives the quota type from error inspection (RPD vs RPM vs concurrency).
 */
function deriveQuotaType(error: unknown): QuotaType | undefined {
  if (isRpdError(error)) return "RPD";
  if (isRateLimitError(error)) {
    const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (msg.includes("concurrency") || msg.includes("concurrent")) return "CONCURRENCY";
    return "RPM";
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("concurrency") || msg.includes("concurrent")) return "CONCURRENCY";
  }
  return undefined;
}

/**
 * Wraps any thrown AI provider failure into an `AiProviderError` with a Turkish
 * scenario-based user message, preserving the original error as the cause.
 *
 * @param error - The raw thrown error from the provider call.
 * @param provider - The provider name used for technical diagnostics.
 * @returns An `AiProviderError` instance ready to cross the server boundary.
 */
export function toAiProviderError(
  error: unknown,
  provider: string,
): AiProviderError {
  if (error instanceof AiProviderError) {
    // Already enriched — ensure quota fields are present even if created via legacy path
    if (error.quotaType !== undefined || error.retryAfterMs !== undefined) return error;
    const quotaType = deriveQuotaType(error.cause ?? error);
    const retryAfterMs = extractRetryDelayMs(error.cause ?? error) ?? undefined;
    const resetsAt =
      quotaType === "RPD"
        ? getPacificMidnightResetISO()
        : retryAfterMs
          ? new Date(Date.now() + retryAfterMs).toISOString()
          : undefined;
    if (quotaType || retryAfterMs || resetsAt) {
      return new AiProviderError({
        message: error.message,
        userMessage: error.userMessage,
        statusCode: error.statusCode,
        code: error.code,
        isOperational: error.isOperational,
        cause: error.cause ?? error,
        technicalDetails: error.technicalDetails,
        quotaType: quotaType ?? error.quotaType,
        retryAfterMs: retryAfterMs ?? error.retryAfterMs,
        resetsAt: resetsAt ?? error.resetsAt,
        meta: error.meta,
      });
    }
    return error;
  }

  const scenario = classifyError(error);
  const quotaType = deriveQuotaType(error);
  const retryAfterMs = extractRetryDelayMs(error) ?? undefined;
  const quotaDetails = extractQuotaDetails(error);
  const resetsAt =
    quotaType === "RPD"
      ? getPacificMidnightResetISO()
      : retryAfterMs
        ? new Date(Date.now() + retryAfterMs).toISOString()
        : undefined;

  return new AiProviderError({
    cause: error,
    technicalDetails: {
      provider,
      scenario,
      httpStatus: extractHttpStatus(error),
      quotaDetails: quotaDetails ?? undefined,
    },
    userMessage: TURKISH_ERROR_BY_SCENARIO[scenario],
    quotaType,
    retryAfterMs,
    resetsAt,
    meta: quotaDetails
      ? {
          quotaMetric: quotaDetails.quotaMetric,
          quotaId: quotaDetails.quotaId,
          quotaValue: quotaDetails.quotaValue,
        }
      : undefined,
  });
}
