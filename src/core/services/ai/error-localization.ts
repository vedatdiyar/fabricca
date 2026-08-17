import { AiProviderError } from "@/lib/errors/app-error";
import { classifyError, type ErrorScenario } from "./error-classifier";
import { extractHttpStatus } from "./llm-errors";

export const TURKISH_ERROR_BY_SCENARIO: Record<ErrorScenario, string> = {
  quota:
    "Yapay zeka hizmetinin anlık kullanım limitine ulaşıldı. Lütfen birkaç dakika sonra tekrar deneyin.",
  network:
    "Yapay zeka hizmetine bağlanılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.",
  system:
    "Yapay zeka hizmeti şu anda yanıt veremiyor. Lütfen daha sonra tekrar deneyin.",
};

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
  if (error instanceof AiProviderError) return error;

  const scenario = classifyError(error);

  return new AiProviderError({
    cause: error,
    technicalDetails: {
      provider,
      scenario,
      httpStatus: extractHttpStatus(error),
    },
    userMessage: TURKISH_ERROR_BY_SCENARIO[scenario],
  });
}
