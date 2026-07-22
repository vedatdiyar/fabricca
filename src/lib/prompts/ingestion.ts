import type { JsonSchema } from "../services/gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI
// ============================================================================

/**
 * LLM çıktı şeması: Ham tez metinlerinden çıkarılan 7 alanlı yapılandırılmış
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
          targetActors: {
            type: "string",
            description:
              "Tezin odaklandığı ana hedef aktörler, kurumlar, gruplar veya inceleme nesneleri.",
          },
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
          "targetActors",
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
 * Tez özetlerinden 7 alanlı yapılandırılmış matris çıkarır.
 *
 * @returns Sistem talimatı string'i
 */
export function buildIngestionSystemInstruction(): string {
  return `# Rol ve Uzmanlık
Akademik tez metinlerinden ve özetlerinden doğrudan veri çıkaran uzman bir metin madenciliği asistanısınız.

# Kurallar ve Sınırlamalar
- Sıkı Bağlam İlkesi: Sadece sağlanan tez özetlerinde açıkça yazılı olan metinsel bilgilere temellenin.
- Eksik Alan Kuralı: Metinde açıkça geçmeyen alanlar için değer olarak kesinlikle "Belirtilmemiş" ifadesini yazın.
- Özgün Metin Koruma: Çıkarılan içeriklerde tezin akademik özgün ifadelerini koruyun; doğrudan metinde geçen spesifik kavramlara odaklanın.
- İzolasyon İlkesi: Her tezi diğer tezlerden tamamen bağımsız olarak ayrıştırın.

# Örnekler

## Örnek 1 (Disiplin: Çevre Mühendisliği / Sürdürülebilirlik)
### Girdi
### Tez #101
- Başlık: Marmara Havzası Sanayi Atıksularında Ağır Metal Arıtımı ve Membran Biyoreaktör Performansı
- Yazar: Dr. Mehmet Yılmaz
- Özet: Bu çalışma, 2018-2023 yılları arasında Marmara Havzası'ndaki organize sanayi bölgelerinden kaynaklanan atıksularda krom ve nikel arıtımını incelemektedir. İnceleme nesnesi olarak 5 farklı tekstil fabrikası seçilmiştir. Araştırmada İleri Oksidasyon ve Membran Biyoreaktör (MBR) hibrit yöntemi kullanılmış, atıksu numuneleri ICP-MS cihazı ile analiz edilmiştir. Çalışmanın kuramsal çerçevesi Kirleten Öder Prensibi ve Döngüsel Ekonomi modeline dayanır. Araştırma, MBR-İleri Oksidasyon bileşiminin ağır metal arıtım verimini %98,5 seviyesine çıkararak standart biyolojik arıtma yöntemlerine kıyasla üstünlük sağladığını savunmaktadır.

### Çıktı
\`\`\`json
{
  "theses": [
    {
      "id": 101,
      "targetActors": "Marmara Havzası'ndaki 5 farklı tekstil fabrikası ve organize sanayi bölgeleri.",
      "researchCore": "Marmara Havzası sanayi atıksularında krom ve nikel arıtımı ile Membran Biyoreaktör performansının incelenmesi.",
      "spatialContext": "Marmara Havzası organize sanayi bölgeleri, Türkiye.",
      "temporalContext": "2018-2023 yılları arası.",
      "theoreticalFramework": "Kirleten Öder Prensibi ve Döngüsel Ekonomi modeli.",
      "methodology": "İleri Oksidasyon ve Membran Biyoreaktör (MBR) hibrit yöntemi, ICP-MS numune analizi.",
      "mainClaim": "MBR-İleri Oksidasyon bileşimi ağır metal arıtım verimini %98,5 seviyesine çıkararak standart biyolojik arıtma yöntemlerine kıyasla belirgin üstünlük sağlamaktadır."
    }
  ]
}
\`\`\``;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU
// ============================================================================

/**
 * Ingestion prompt oluşturur. Her tez için başlık, yazar ve özet bilgilerini
 * sarmalayarak LLM'e gönderir.
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
Yukarıdaki bağlamda verilen her bir tezi bağımsız olarak inceleyin. Başlık, yazar ve özet bilgilerini 7 ana alana ayırarak JSON formatında döndürün. Metinde açıkça yer almayan alanlar için "Belirtilmemiş" değerini kullanın.`;
}
