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

    rulesAndConstraints: `1. **persona:** SOCRATIC_ADVISOR eğer kullanıcı bir tez fikri, hipotez, yazım planı veya eleştiri/geri bildirim istiyorsa seçilir. TEZ_ASSISTANT eğer kullanıcı tanımsal bir kavram sorusu, literatür araması, APA kuralı veya veritabanı işlemi soruyorsa seçilir.
2. **isActionQuery:** Kullanıcı açıkça veritabanı ekleme/güncelleme/silme veya araç çalıştırma istiyorsa true yapılır.
3. **mode:** Eğer kullanıcı mesajı denetlenip kritik tartışılacak paragraf/taslak metni (özellikle İngilizce tez pasajı) ise PIPELINE; bağımsız doğrudan bir soru ise DIRECT seçilir.`,

    outputFormat:
      "Çıktı, persona, reasoning, isActionQuery ve mode alanlarını içeren JSON nesnesidir.",

    examples: `<example>
<input>
=== KULLANICININ SON MESAJI ===
David Romano'nun etnik mobilizasyon modeli ile Gramsci'nin hegemonya yaklaşımını birleştirmeyi düşünüyorum, bu teorik olarak nasıl savunulabilir?
</input>
<output>
{
  "persona": "SOCRATIC_ADVISOR",
  "reasoning": "Kullanıcı kuramsal bir sentez fikri ve hipotez savunusu hakkında derinlemesine akademik rehberlik istemektedir.",
  "isActionQuery": false,
  "mode": "DIRECT"
}
</output>
</example>

<example>
<input>
=== KULLANICININ SON MESAJI ===
Kütüphaneme 'Kürt Hareketi' etiketli yeni bir alt kutu ekler misin?
</input>
<output>
{
  "persona": "TEZ_ASSISTANT",
  "reasoning": "Kullanıcı doğrudan veritabanına yeni bir alt kutu ekleme işlemi talep etmektedir.",
  "isActionQuery": true,
  "mode": "DIRECT"
}
</output>
</example>

<example>
<input>
=== KULLANICININ SON MESAJI ===
During the 1990s, the Kurdish political movement underwent a discursive transformation. Romano (2006, p. 45) argues that the legal parties completely abandoned the armed strategy. In this section, I evaluate whether this transformation corresponds to Gramsci's concept of war of position.
</input>
<output>
{
  "persona": "SOCRATIC_ADVISOR",
  "reasoning": "Kullanıcı kaynak atıfları ve tez argümanı içeren bir taslak paragraf göndermiştir; katı kaynak denetimi ve eleştirel analiz gerektirmektedir.",
  "isActionQuery": false,
  "mode": "PIPELINE"
}
</output>
</example>`,

    inputContext: `${historyText ? `### SOHBET GEÇMİŞİ:\n${historyText}\n\n` : ""}### KULLANICININ SON MESAJI:\n${userQuery}`,

    taskTrigger:
      "Yukarıdaki <context> içeriğindeki kullanıcı mesajını ve geçmişi <instructions> kurallarına göre analiz ederek niyet sınıflandırmasını JSON formatında üret.",
  });
}
