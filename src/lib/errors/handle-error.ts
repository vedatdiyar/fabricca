import { z } from "zod";
import { Logger, createFlowId } from "@/lib/logger";
import { AppError, ValidationError } from "./app-error";

export interface ActionErrorResult {
  success: false;
  error: string;
  code: string;
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

  if (error instanceof AppError) {
    const payload = {
      data: { code: error.code, statusCode: error.statusCode },
      error,
    };
    if (error.isOperational) {
      log.warn("action_operational_error", payload);
    } else {
      log.error("action_system_error", payload);
    }
    return { success: false, error: error.userMessage, code: error.code };
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
