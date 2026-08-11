import { classifyError } from "@/services/ai/llm-errors";
import type { ErrorScenario } from "@/services/ai/llm-errors";

export {
  classifyError,
  extractMessage,
  type ErrorScenario,
} from "@/services/ai/llm-errors";

/** Safe, user-ready error display derived from a masked internal scenario. */
export interface ErrorDisplay {
  title: string;
  description: string;
  scenario: ErrorScenario;
  canRetry: boolean;
}

const ERROR_DISPLAY_MAP: Record<
  ErrorScenario,
  { title: string; description: string; canRetry: boolean }
> = {
  quota: {
    title: "Günlük Analiz Limitine Ulaşıldı",
    description: "Yarın tekrar görüşmek üzere...",
    canRetry: false,
  },
  network: {
    title: "Bağlantı Kesildi",
    description:
      "Akademik veritabanı ile iletişim kurulamıyor. Lütfen internet bağlantınızı kontrol edin.",
    canRetry: true,
  },
  system: {
    title: "Analiz Başlatılamadı",
    description:
      "Sistemde beklenmeyen bir teknik aksaklık oluştu. Lütfen biraz sonra tekrar deneyin.",
    canRetry: true,
  },
};

/**
 * Maps an error to a safe, user-ready display; raw details never leak to the output.
 *
 * @param error - The error value to map.
 * @returns The user-ready error display.
 */
export function getErrorDisplay(error: unknown): ErrorDisplay {
  const scenario = classifyError(error);
  const config = ERROR_DISPLAY_MAP[scenario];

  return {
    title: config.title,
    description: config.description,
    scenario,
    canRetry: config.canRetry,
  };
}
