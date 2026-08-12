import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";

/**
 * Builds the standardized PromptPayload for advisor chat title generation.
 *
 * @param userQuery - The first user prompt query.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildChatTitlePromptPayload(userQuery: string): PromptPayload {
  return buildPromptPayload({
    roleAndExpertise: "Sen bir akademik tez asistanısın.",

    primaryTask:
      "Kullanıcının sorduğu soruyu analiz ederek bu sohbet için 3 ila 5 kelimelik, net, öz ve Türkçe bir konu başlığı çıkar.",

    rulesAndConstraints: `1. Konu başlığını doğrudan 3-5 kelimelik yalın Türkçe isim tamlaması olarak yaz.
2. Yalnızca başlık metnini döndür (noktalama, tırnak veya açıklama içermeksizin).`,

    outputFormat: "Çıktı, 'title' alanını içeren saf JSON nesnesidir.",

    examples: `## Örnekler
- David Romano Etnisite Yaklaşımı
- Primordiyalist Kuram Analizi
- Söylem Analizi Metodolojisi`,

    inputContext: `Kullanıcı Sorusu: ${userQuery}`,
  });
}
