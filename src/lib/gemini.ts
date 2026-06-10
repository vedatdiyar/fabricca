import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { GenerateContentConfig } from "@google/genai";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export type { z };

type ConfigWithResponseFormat = GenerateContentConfig & {
  responseFormat: {
    text: {
      mimeType: "application/json";
      schema: ReturnType<typeof zodToJsonSchema>;
    };
  };
};

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is not defined");
}

const ai = new GoogleGenAI({ apiKey });

/**
 * Gemini modelinden yapılandırılmış JSON çıktısı almak için generic yardımcı.
 * Temperature her zaman 1.0 olarak sabitlenir, thinkingConfig high seviyede
 * çalışır ve yanıt, verilen Zod şemasına göre JSON olarak parse edilir.
 * SDK tip tanımında responseFormat bulunmadığı için ConfigWithResponseFormat
 * tipiyle genişletilerek çağrı yapılır.
 *
 * @param modelName - Kullanılacak Gemini model adı (örn. "gemini-3.1-flash-lite")
 * @param systemInstruction - Sistem talimatı (persona + kurallar)
 * @param prompt - Kullanıcı promptu
 * @param schema - Yanıtın doğrulanacağı Zod şeması
 * @returns Şemaya uygun olarak parse edilmiş tip güvenli nesne
 */
export async function generateStructuredContent<T extends z.ZodTypeAny>(
  modelName: string,
  systemInstruction: string,
  prompt: string,
  schema: T,
): Promise<z.infer<T>> {
  console.log("[generateStructuredContent] Başladı. Model:", modelName);
  console.log("[generateStructuredContent] systemInstruction uzunluğu:", systemInstruction.length);
  console.log("[generateStructuredContent] prompt uzunluğu:", prompt.length);

  let response;

  const jsonSchema = zodToJsonSchema(schema);
  console.log("[generateStructuredContent] Zod şeması JSON Schema'ya dönüştürüldü.");

  try {
    console.log("[generateStructuredContent] Gemini API çağrısı yapılıyor...");
    response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        temperature: 1.0,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseFormat: {
          text: {
            mimeType: "application/json",
            schema: jsonSchema,
          },
        },
      } as ConfigWithResponseFormat,
    });
    console.log("[generateStructuredContent] API çağrısı başarılı.");
    console.log("[generateStructuredContent] response.text mevcut:", !!response.text);
    console.log("[generateStructuredContent] response.text (ilk 200):", response.text?.slice(0, 200));
  } catch (error) {
    console.error("[Gemini API Hatası]:", error);
    console.error("[Gemini API Hatası] error.name:", (error as Error)?.name);
    console.error("[Gemini API Hatası] error.message:", (error as Error)?.message);
    console.error("[Gemini API Hatası] error.stack:", (error as Error)?.stack);
    throw new Error(
      `Gemini API çağrısı başarısız: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`,
    );
  }

  const text = response.text;

  if (!text) {
    console.error("[generateStructuredContent] response.text BOŞ!");
    console.error("[generateStructuredContent] response.candidates:", JSON.stringify(response.candidates));
    console.error("[generateStructuredContent] response.promptFeedback:", JSON.stringify(response.promptFeedback));
    throw new Error("Gemini yanıtı boş döndü.");
  }

  try {
    const parsed = JSON.parse(text) as z.infer<T>;
    console.log("[generateStructuredContent] JSON parse başarılı.");
    return parsed;
  } catch (parseError) {
    console.error("[Gemini Parse Hatası]: Yanıt JSON değil. text:", text);
    console.error("[Gemini Parse Hatası] parseError:", parseError);
    throw new Error("Gemini yanıtı geçerli bir JSON değil.");
  }
}
