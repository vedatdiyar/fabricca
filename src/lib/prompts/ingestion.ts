import type { JsonSchema } from "../services/gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI
// ============================================================================

/**
 * LLM çıktı şeması: Ham tez metinlerinden çıkarılan 6 alanlı yapılandırılmış
 * matris. Her tez bağımsız olarak parse edilir.
 */
export const ingestionResponseSchema: JsonSchema = {
  type: "object",
  properties: {
    theses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "number", description: "Tezin ID numarası" },
          researchCore: {
            type: "string",
            description:
              "Tezin araştırma odağı, temel problemi ve odaklandığı ana aktörler, özneler veya analiz nesneleri.",
          },
          spatialContext: {
            type: "string",
            description:
              "Tezin geçtiği coğrafi mekân, bölge, ülke veya kurumsal ortam.",
          },
          temporalContext: {
            type: "string",
            description:
              "Tezin odaklandığı dönem, tarihsel aralık, siyasal/toplumsal zamansal kesit.",
          },
          theoreticalFramework: {
            type: "string",
            description:
              "Tezin dayandığı kuramsal çerçeve, teorik model, kurucu yazarlar ve kavramlar.",
          },
          methodology: {
            type: "string",
            description:
              "Tezin kullandığı araştırma yöntemi, veri toplama araçları, analiz teknikleri ve örneklem bilgisi.",
          },
          mainClaim: {
            type: "string",
            description:
              "Tezin ana argümanı, temel iddiası veya savunduğu ana tez.",
          },
        },
        required: [
          "id",
          "researchCore",
          "spatialContext",
          "temporalContext",
          "theoreticalFramework",
          "methodology",
          "mainClaim",
        ],
      },
    },
  },
  required: ["theses"],
};

// ============================================================================
// 2. SİSTEM TALİMATI
// ============================================================================

/**
 * Ingestion pipeline için sistem talimatı.
 * Tezara'dan gelen temiz tez özetlerinden 6 alanlı yapılandırılmış matris çıkarır.
 *
 * @returns Sistem talimatı string'i
 */
export function buildIngestionSystemInstruction(): string {
  return `<constraints>
- You are a strictly grounded extraction assistant. You ONLY extract information that is *explicitly written* in the provided text. You do NOT infer, assume, guess, or use your own knowledge or training data.
- [EKSİK ALAN KURALI]: Eğer 6 alandan herhangi biri için verilen metinde açık, spesifik ve doğrudan bir bilgi yoksa, o alana "Belirtilmemiş" yazın. Asla tahmin yürütmeyin, uydurmayın, metinde olmayan bir teorisyen/yıl/yöntem eklemeyin.
- [TEK KAYNAK KURALI]: Tüm bilgiler sadece sağlanan <tez id='X'> bloklarından alınmalıdır. Modelin kendi bilgisi KESİNLİKLE kullanılamaz.
- [ÖZGÜN METİN KORUMA]: Çıkarılan akademik içerik, tezin özünden kopmayacak şekilde özgün ifadeleri korumalı, gereksiz yere yeniden yazılmamalı veya genelleştirilmemelidir.
- ÇIKTI FORMATI: ingestionResponseSchema ile %100 uyumlu bir JSON objesi döndürün. Her tez kendi <tez id='X'> bloğundan bağımsız olarak parse edilmelidir.
</constraints>

<task>
Akademik tez özetlerinden 6 alanlı yapılandırılmış matris çıkaran uzman bir metin madencisi rolündesiniz. Göreviniz, her bir tez için başlık, yazar ve özet bilgilerini inceleyerek 6 ana alana ayırmaktır. Her bir tezi bağımsız olarak işleyin. Hiçbir bilgi uydurmayın, sadece metinde yazanı çıkarın.
</task>`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU
// ============================================================================

/**
 * Ingestion prompt oluşturur. Her tez için başlık, yazar ve özet bilgilerini
 * <tez id='X'> XML etiketleri içinde sarmalayarak LLM'e gönderir.
 *
 * @param details - Tez detayları (id, title, author, abstract)
 * @returns Kullanıcı prompt string'i
 */
export function buildIngestionPrompt(
  details: { id: number; title: string; author: string; abstract: string }[],
): string {
  const thesisBlocks = details
    .map(
      (t) => `<tez id="${t.id}">
Başlık: ${t.title}
Yazar: ${t.author}
Özet:
${t.abstract}
</tez>`,
    )
    .join("\n");

  return `<context>
${thesisBlocks}
</context>

<task>
Yukarıdaki <context> bloğunda <tez id='X'> etiketleriyle verilen her bir tez için, başlık, yazar ve özet bilgilerini inceleyerek 6 alana ayırın ve ingestionResponseSchema şemasına uygun JSON olarak döndürün. Metinde açıkça geçmeyen alanlar için "Belirtilmemiş" değerini kullanın. Her tezi bağımsız olarak işleyin.
</task>`;
}
