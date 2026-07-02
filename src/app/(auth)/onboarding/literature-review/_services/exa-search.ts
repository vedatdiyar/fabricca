import { Type } from "@google/genai";
import type { Logger } from "@/lib/logger";

export interface ExaResult {
  title: string;
  url: string;
  author?: string;
  text?: string;
  publishedDate?: string;
  highlights?: string[];
}

export interface ExaConfig {
  query: string;
  category?: string;
  type: string;
  systemPrompt?: string;
  contents: Record<string, unknown>;
  numResults: number;
}

export const exaSearchTool = {
  functionDeclarations: [
    {
      name: "exa_academic_search",
      description:
        "Akademik indekslerde (DergiPark, Google Scholar, Exa) semantik arama yaparak gerçek makale ve kitapları getirir. Kutu türüne göre category, type ve systemPrompt parametreleri factory tarafından otomatik enjekte edilir.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description:
              "Kutunun ruhuna uygun, uydurma olmayan, literatürde kullanılan saf akademik semantik arama sorgusu.",
          },
          category: {
            type: Type.STRING,
            enum: [
              "research paper",
              "news",
              "company",
              "people",
              "personal site",
              "financial report",
            ],
            description:
              "Exa API kategorisi. Kutu türüne göre factory tarafından atanır. CONCEPTUAL kutularda serbest web araması için gönderilmez, PROBLEMATIZATION/CONTEXT kutularında 'research paper' kullanılır.",
          },
          type: {
            type: Type.STRING,
            enum: [
              "auto",
              "fast",
              "instant",
              "deep-lite",
              "deep",
              "deep-reasoning",
            ],
            description:
              "Exa arama türü. Factory tarafından yönetilir; varsayılan 'auto'.",
          },
          systemPrompt: {
            type: Type.STRING,
            description:
              "Arama motorunun planlama yapmasını sağlayan jenerik direktif. CONCEPTUAL kutularda kurucu eser odaklı talimat enjekte edilir.",
          },
        },
        required: ["query"],
      },
    },
  ],
};

/**
 * Kutu türüne göre Exa API parametrelerini üreten fabrika.
 *
 * @param boxType - Kutunun tipi (CONCEPTUAL, PROBLEMATIZATION, CONTEXT, ...)
 * @param query - Orijinal semantik sorgu
 * @param researchScope - Matristen gelen araştırma kapsamı (coğrafi/tarihsel kısıt)
 * @param log - Logger instance'ı (fallback logları için)
 * @returns ExaConfig — Exa API'sine gönderilecek parametreler
 */
export function buildExaConfig(
  boxType: string,
  query: string,
  researchScope: string,
  log?: Logger,
): ExaConfig {
  switch (boxType) {
    case "CONCEPTUAL": {
      log?.info("exa_factory_conceptual", {
        service: "boxes",
        data: {
          rule: "category=undefined, type=auto, systemPrompt=foundational",
          boxType,
        },
      });
      return {
        query,
        type: "auto",
        systemPrompt:
          "Identify the foundational books, monumental primary works, and highly-cited origin texts for the requested theory. Avoid modern application papers or peripheral case studies.",
        contents: { highlights: true },
        numResults: 5,
      };
    }
    case "PROBLEMATIZATION":
    case "CONTEXT": {
      const enrichedQuery = `${query} ${researchScope}`;
      log?.info("exa_factory_applicative", {
        service: "boxes",
        data: {
          rule: "category=research paper, type=auto, researchScope appended",
          boxType,
          researchScope,
        },
      });
      return {
        query: enrichedQuery,
        category: "research paper",
        type: "auto",
        contents: { highlights: true },
        numResults: 5,
      };
    }
    default: {
      log?.info("exa_factory_default", {
        service: "boxes",
        data: {
          rule: "category=research paper, type=auto (fallback)",
          boxType,
        },
      });
      return {
        query,
        category: "research paper",
        type: "auto",
        contents: { highlights: true },
        numResults: 5,
      };
    }
  }
}

/**
 * Vanilla yedek konfigürasyon — parametre hatası durumunda kullanılır.
 * Eski kararlı yapı: category: undefined, ham sorgu, text mode.
 */
export function buildVanillaFallbackConfig(originalQuery: string): ExaConfig {
  return {
    query: originalQuery,
    type: "auto",
    contents: { text: { maxCharacters: 15000 } },
    numResults: 5,
  };
}

/**
 * Parses the Retry-After header which can be seconds or an HTTP-date.
 * Returns the delay in milliseconds, or null if invalid or missing.
 */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }
  const dateMs = Date.parse(header);
  if (!isNaN(dateMs)) {
    const diff = dateMs - Date.now();
    return diff > 0 ? diff : 0;
  }
  return null;
}

/**
 * Exa API semantik arama fonksiyonu.
 * Factory tarafından üretilen ExaConfig ile çağrılır.
 * 400/422 parametre hatalarında otomatik olarak vanilla yapıya düşer.
 * 429 rate limit durumunda Retry-After başlığına riayet ederek
 * üstel geri çekilme (exponential backoff) ve jitter ile yeniden dener.
 *
 * @param cfg - Factory tarafından üretilen Exa çağrı konfigürasyonu
 * @param originalQuery - Rollback durumunda kullanılacak ham sorgu
 * @param log - Loglama için Logger instance'ı
 * @returns Arama sonuçları listesi
 */
export async function searchExa(
  cfg: ExaConfig,
  originalQuery: string,
  log?: Logger,
): Promise<ExaResult[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey)
    throw new Error("EXA_API_KEY environment variable is not defined");

  const maxRetries = 4;
  let attempt = 0;
  let currentConfig = cfg;
  let hasRolledBack = false;

  while (true) {
    attempt++;
    try {
      const body: Record<string, unknown> = {
        query: currentConfig.query,
        type: currentConfig.type,
        numResults: currentConfig.numResults,
      };
      if (currentConfig.category !== undefined) {
        body.category = currentConfig.category;
      }
      if (currentConfig.systemPrompt !== undefined) {
        body.systemPrompt = currentConfig.systemPrompt;
      }
      if (Object.keys(currentConfig.contents).length > 0) {
        body.contents = currentConfig.contents;
      }

      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify(body),
      });

      if (
        !hasRolledBack &&
        (response.status === 400 || response.status === 422)
      ) {
        log?.warn("exa_parameter_error_fallback", {
          service: "boxes",
          data: {
            status: response.status,
            boxType: cfg.systemPrompt
              ? "CONCEPTUAL"
              : cfg.category
                ? "PROBLEMATIZATION/CONTEXT"
                : "UNKNOWN",
            attempt,
            query: currentConfig.query,
          },
        });
        currentConfig = buildVanillaFallbackConfig(originalQuery);
        hasRolledBack = true;
        continue;
      }

      if (response.status === 429) {
        if (attempt > maxRetries) {
          log?.error("exa_rate_limit_exhausted", {
            service: "boxes",
            data: { query: currentConfig.query, maxRetries },
          });
          return [];
        }

        const retryAfterHeader = response.headers.get("retry-after");
        const parsedDelay = parseRetryAfter(retryAfterHeader);

        const exponent = attempt - 1;
        const backoffDelay = 2000 * Math.pow(2, exponent);
        const jitter = Math.random() * 1000;
        const delay =
          parsedDelay !== null ? parsedDelay : backoffDelay + jitter;

        log?.warn("exa_rate_limited", {
          service: "boxes",
          data: {
            attempt,
            maxRetries,
            delayMs: Math.round(delay),
            retryAfterHeader,
            rolledBack: hasRolledBack,
          },
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        log?.error("exa_non_ok_response", {
          service: "boxes",
          data: { status: response.status, query: currentConfig.query },
        });
        return [];
      }

      const data = (await response.json()) as {
        results: Array<{
          title: string;
          url: string;
          author?: string;
          text?: string;
          publishedDate?: string;
          highlights?: string[];
        }>;
      };

      if (hasRolledBack) {
        log?.info("exa_rollback_success", {
          service: "boxes",
          data: {
            resultCount: data.results?.length ?? 0,
            originalQuery,
          },
        });
      }

      return data.results || [];
    } catch (error) {
      const is429Retryable =
        error instanceof Error &&
        (error.message.includes("429") || error.message.includes("quota"));

      if (is429Retryable && attempt <= maxRetries) {
        const exponent = attempt - 1;
        const delay = 2000 * Math.pow(2, exponent) + Math.random() * 1000;
        log?.warn("exa_429_retry", {
          service: "boxes",
          data: {
            attempt,
            maxRetries,
            delayMs: Math.round(delay),
            error: error.message,
            rolledBack: hasRolledBack,
          },
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      log?.error("exa_search_failed", {
        service: "boxes",
        data: {
          query: currentConfig.query,
          attempt,
          error: error instanceof Error ? error.message : String(error),
          rolledBack: hasRolledBack,
        },
      });
      return [];
    }
  }
}
