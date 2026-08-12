import { buildPromptPayload, type PromptPayload } from "@/lib/ai/prompt-builder";

export interface ClassifierPromptInput {
  userQuery: string;
  historyText?: string;
}

/**
 * Builds the standardized PromptPayload for Advisor intent classification.
 *
 * @param params - User query and history text.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildClassifierPromptPayload(
  params: ClassifierPromptInput
): PromptPayload {
  const { userQuery, historyText } = params;

  return buildPromptPayload({
    roleAndExpertise:
      "Sen dijital tez asistanı sisteminin niyet sınıflandırıcısısın (Intent Classifier).",

    primaryTask:
      "Kullanıcının son mesajını ve sohbet geçmişini inceleyerek devreye girmesi gereken personas (SOCRATIC_ADVISOR / TEZ_ASSISTANT), veritabanı işlem durumu (isActionQuery) ve akış modunu (DIRECT / PIPELINE) belirlemektir.",

    rulesAndConstraints: `1. **persona:** SOCRATIC_ADVISOR eğer kullanıcı bir tez fikri, hipotez, yazım planı veya eleştiri/geri bildirim istiyorsa seçilir. TEZ_ASSISTANT eğer kullanıcı tanımsal bir kavram sorusu, literatür araması, APA kuralı veya veritabanı işlemi soruyorsa seçilir.
2. **isActionQuery:** Kullanıcı açıkça veritabanı ekleme/güncelleme/silme veya araç çalıştırma istiyorsa true yapılır.
3. **mode:** Eğer kullanıcı mesajı denetlenip kritik tartışılacak paragraf/taslak metni (özellikle İngilizce tez pasajı) ise PIPELINE; bağımsız doğrudan bir soru ise DIRECT seçilir.`,

    outputFormat:
      "Çıktı, persona, reasoning, isActionQuery ve mode alanlarını içeren JSON nesnesidir.",

    inputContext: `${historyText ? `=== SOHBET GEÇMİŞİ ===\n${historyText}\n\n` : ""}=== KULLANICININ SON MESAJI ===\n${userQuery}`,
  });
}
