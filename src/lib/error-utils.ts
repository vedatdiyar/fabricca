export type ErrorScenario = "quota" | "network" | "system";

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
 * Classifies any error into a user-facing scenario (quota, network, or system).
 *
 * @param error - The error value to classify.
 * @returns The matched error scenario.
 */
export function classifyError(error: unknown): ErrorScenario {
  const message = extractMessage(error);
  if (!message) return "system";

  const lower = message.toLowerCase();

  if (
    lower.includes("429") ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota exceeded") ||
    lower.includes("quota")
  ) {
    return "quota";
  }

  if (
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("timeout") ||
    lower.includes("503") ||
    lower.includes("502") ||
    lower.includes("enotfound") ||
    lower.includes("econnrefused") ||
    lower.includes("eai_again") ||
    lower.includes("econnreset")
  ) {
    return "network";
  }

  return "system";
}

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

/**
 * Extracts a readable string message from any error value.
 *
 * @param error - The error value to extract a message from.
 * @returns The extracted message, or an empty string.
 */
export function extractMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.message === "string") return obj.message;

    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") return serialized;
    } catch {}
  }

  return "";
}
