/**
 * Merkezi Hata Maskeleme ve Kullanıcı Dostu Hata Gösterim Kütüphanesi.
 *
 * Hiçbir teknik detay, stack trace veya JSON objesi bu katmandan
 * son kullanıcıya sızmaz. Her hata, önceden tanımlı üç senaryodan
 * birine maskelenerek güvenli ve anlaşılır bir metin çiftine
 * (Başlık + Açıklama) dönüştürülür.
 *
 * Kullanıcı ne görürse görsün, geliştirici Logger ile orijinal hatayı
 * terminalde görmeye devam eder.
 */

export type ErrorScenario = "quota" | "network" | "system";

export interface ErrorDisplay {
  /** Kullanıcıya gösterilecek kısa başlık (örn: "Bağlantı Kesildi") */
  title: string;
  /** Kullanıcıya gösterilecek açıklama metni */
  description: string;
  /** Hangi senaryoya ait olduğu (icon/border seçimi için) */
  scenario: ErrorScenario;
  /** "Yeniden Dene" butonu gösterilip gösterilmeyeceği */
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
 * Hata içeriğini analiz ederek hangi senaryoya ait olduğunu belirler.
 *
 * @param error - Analiz edilecek hata (Error, string, Record, null, undefined)
 * @returns Tespit edilen hata senaryosu
 *
 * @example
 *   classifyError(new Error("429 Too Many Requests")) // "quota"
 *   classifyError("fetch failed")                     // "network"
 *   classifyError("Bilinmeyen hata")                   // "system"
 */
export function classifyError(error: unknown): ErrorScenario {
  const message = extractMessage(error);
  if (!message) return "system";

  const lower = message.toLowerCase();

  // Senaryo A — Kota / Aşım Hatası
  if (
    lower.includes("429") ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota exceeded") ||
    lower.includes("quota")
  ) {
    return "quota";
  }

  // Senaryo B — Bağlantı / İnternet Hatası
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

  // Senaryo C — Bilinmeyen / Sistem Hatası (Fallback)
  return "system";
}

/**
 * Herhangi bir tipteki hatayı güvenli bir ekran metnine dönüştürür.
 * Orijinal hata detayı ASLA dönüş değerine sızmaz.
 *
 * @param error - Maskelenecek hata (Error, string, Record, null, undefined)
 * @returns Kullanıcıya gösterilmeye hazır güvenli metin çifti
 *
 * @example
 *   const display = getErrorDisplay(err);
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
 * Hata değerinden okunabilir bir string mesaj çıkarır.
 * Bu fonksiyon sadece classifyError için kullanılır;
 * UI katmanı asla bu çıktıyı kullanmaz.
 *
 * @param error - Herhangi bir hata değeri
 * @returns normalize edilmiş string mesaj veya boş string
 */
export function extractMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    // { error: "..." } desenindeki hataları yakala
    const obj = error as Record<string, unknown>;
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.message === "string") return obj.message;

    // JSON.stringify benzeri içeriği tara
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") return serialized;
    } catch {
      // Circular reference durumunda sessizce devam et
    }
  }

  return "";
}
