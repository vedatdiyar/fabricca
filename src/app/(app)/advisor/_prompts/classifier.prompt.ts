import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";

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
  params: ClassifierPromptInput,
): PromptPayload {
  const { userQuery, historyText } = params;

  return buildPromptPayload({
    roleAndExpertise:
      "Sen dijital tez asistanı sisteminin niyet sınıflandırıcısısın (Intent Classifier).",

    primaryTask:
      "Kullanıcının son mesajını ve sohbet geçmişini inceleyerek devreye girmesi gereken personas (SOCRATIC_ADVISOR / TEZ_ASSISTANT), veritabanı işlem durumu (isActionQuery) ve akış modunu (DIRECT / PIPELINE) belirlemektir.",

    rulesAndConstraints: `1. **persona:** TEZ_ASSISTANT eğer kullanıcı veritabanı ekleme/güncelleme/silme/araç işlemi istiyorsa, tanımsal kavram sorusu, literatür araması veya APA kuralı soruyorsa seçilir. SOCRATIC_ADVISOR SADECE kullanıcı bir tez fikri, hipotez veya yazım planı hakkında fikir/eleştiri/geri bildirim danışıyorsa seçilir.
2. **isActionQuery (ÖNEMLİ):** Kullanıcı mesajı 'güncelle', 'güncelleyelim', 'değiştir', 'değiştirelim', 'ekle', 'ekleyelim', 'sil', 'oluştur', 'kaydet' gibi bir eylem fiiliyle matris, kuramsal çerçeve, problem, yöntem, araştırma kutusu, bölüm planı veya görev değişikliği talep ediyorsa KESİNLİKLE 'isActionQuery: true' ve 'persona: TEZ_ASSISTANT' olarak sınıflandırılmalıdır. Asla Sokratik eleştiri moduna sokulmamalıdır.
3. **mode:** Eğer kullanıcı mesajı denetlenip kritik tartışılacak paragraf/taslak metni (özellikle İngilizce tez pasajı) ise PIPELINE; bağımsız doğrudan bir soru veya işlem ise DIRECT seçilir.`,

    outputFormat:
      'Çıktı, persona, reasoning, isActionQuery ve mode alanlarını içeren JSON nesnesidir. Şema: {"persona": "SOCRATIC_ADVISOR"|"TEZ_ASSISTANT", "reasoning": string, "isActionQuery": boolean, "mode": "DIRECT"|"PIPELINE"}',

    inputContext: `${historyText ? `### SOHBET GEÇMİŞİ:\n${historyText}\n\n` : ""}### KULLANICININ SON MESAJI:\n${userQuery}`,

    taskTrigger:
      "Yukarıdaki <context> içeriğindeki kullanıcı mesajını ve geçmişi <instructions> kurallarına göre analiz ederek niyet sınıflandırmasını JSON formatında üret.",
  });
}
