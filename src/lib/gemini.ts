import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { Logger } from "./logger";

export interface JsonSchemaProperty {
  type: string;
  items?:
    | JsonSchemaProperty
    | {
        type: string;
        enum?: string[];
        properties?: Record<string, JsonSchemaProperty>;
        required?: string[];
      };
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  enum?: string[];
  description?: string;
}

export interface JsonSchema {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
}

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is not defined");
}

const ai = new GoogleGenAI({ apiKey });

/**
 * Gemini modelinden yapılandırılmış JSON çıktısı almak için generic yardımcı.
 * Temperature her zaman 1.0 olarak sabitlenir, thinkingConfig high seviyede
 * çalışır ve yanıt, verilen JSON şemasına göre JSON olarak parse edilir.
 *
 * @param modelName - Kullanılacak Gemini model adı (örn. "gemini-3.1-flash-lite")
 * @param systemInstruction - Sistem talimatı (persona + kurallar)
 * @param prompt - Kullanıcı promptu
 * @param schema - Yanıtın doğrulanacağı JSON şeması
 * @param logger - Opsiyonel Logger instance'ı (AI event logları için)
 * @returns Şemaya uygun olarak parse edilmiş tip güvenli nesne
 */
export async function generateStructuredContent<T>(
  modelName: string,
  systemInstruction: string,
  prompt: string,
  schema: JsonSchema,
  logger?: Logger,
): Promise<T> {
  const startTime = performance.now();

  logger?.info("ai_request_start", {
    service: "gemini",
    data: {
      model: modelName,
      instructionLength: systemInstruction.length,
      promptLength: prompt.length,
    },
  });

  let response;

  try {
    response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        temperature: 1.0,
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      },
    });
  } catch (error) {
    const durationMs = performance.now() - startTime;
    logger?.error("ai_request_failed", {
      service: "gemini",
      durationMs,
      data: { model: modelName },
      error,
    });
    throw new Error(
      `Gemini API çağrısı başarısız: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`,
    );
  }

  const text = response.text;

  if (!text) {
    const durationMs = performance.now() - startTime;
    logger?.error("ai_request_failed", {
      service: "gemini",
      durationMs,
      data: {
        model: modelName,
        candidates: response.candidates,
        promptFeedback: response.promptFeedback,
      },
      error: new Error("Gemini yanıtı boş döndü."),
    });
    throw new Error("Gemini yanıtı boş döndü.");
  }

  // ===== 🛡️ ROBUST SANITIZATION & TRUNCATION SAFEGUARD =====
  // 1. Clean markdown code blocks (```json ... ```) if present
  let cleanedText = text.trim();
  if (cleanedText.startsWith("```")) {
    cleanedText = cleanedText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/```$/, "")
      .trim();
  }

  try {
    // 2. Attempt parsing the cleaned text
    const parsed = JSON.parse(cleanedText) as T;
    const durationMs = performance.now() - startTime;
    const metadata = (
      response as unknown as {
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      }
    )?.usageMetadata;

    const tokens = metadata
      ? {
          input: metadata.promptTokenCount,
          output: metadata.candidatesTokenCount,
          total: metadata.totalTokenCount,
        }
      : undefined;

    logger?.info("ai_request_success", {
      service: "gemini",
      durationMs,
      tokens,
      data: { model: modelName },
    });
    return parsed;
  } catch (parseError) {
    const durationMs = performance.now() - startTime;
    logger?.error("ai_parse_failed_recovering", {
      service: "gemini",
      durationMs,
      data: {
        model: modelName,
        responsePreview: cleanedText.substring(0, 200),
      },
      error:
        parseError instanceof Error ? parseError.message : "JSON Parse Error",
    });
    throw parseError;
  }
}
