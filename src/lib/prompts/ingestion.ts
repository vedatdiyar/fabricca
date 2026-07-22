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
  return `# Rol ve Uzmanlık
Akademik tez metinlerinden ve özetlerinden doğrudan veri çıkaran uzman bir metin madenciliği asistanısınız.

# Kurallar ve Sınırlamalar
- Sıkı Bağlam İlkesi: Yalnızca sağlanan tez özetlerinde açıkça yazılı olan bilgileri çıkarın. Asla dışarıdan bilgi eklemeyin, tahmin yürütmeyin veya varsayımda bulunmayın.
- Eksik Alan Kuralı: Metinde açıkça geçmeyen alanlar için değer olarak kesinlikle "Belirtilmemiş" yazın.
- Özgün Metin Koruma: Çıkarılan içeriklerde tezin akademik özgün ifadelerini koruyun; gereksiz genelleştirmeler yapmayın.
- İzolasyon: Her tezi diğer tezlerden tamamen bağımsız olarak ayrıştırın.

# Çıktı Biçimi
- ingestionResponseSchema ile tam uyumlu bir JSON objesi döndürün.`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU
// ============================================================================

/**
 * Ingestion prompt oluşturur. Her tez için başlık, yazar ve özet bilgilerini
 * <tez id='X'> etiketleri içinde sarmalayarak LLM'e gönderir.
 *
 * @param details - Tez detayları (id, title, author, abstract)
 * @returns Kullanıcı prompt string'i
 */
export function buildIngestionPrompt(
  details: { id: number; title: string; author: string; abstract: string }[],
): string {
  const thesisBlocks = details
    .map(
      (t) => `### Tez #${t.id}
- Başlık: ${t.title}
- Yazar: ${t.author}
- Özet: ${t.abstract}`,
    )
    .join("\n\n");

  return `# Girdi Bağlamı
${thesisBlocks}

# Birincil Görev
Yukarıdaki bağlamda verilen her bir tezi bağımsız olarak inceleyin. Başlık, yazar ve özet bilgilerini 6 ana alana ayırarak JSON formatında döndürün. Metinde açıkça yer almayan alanlar için "Belirtilmemiş" değerini kullanın.`;
}
