import type { JsonSchema } from "../services/gemini";
import type { ThesisMatrix } from "../types";

/**
 * Originality ve literatür entegrasyonu analiz süreci için sistem talimatını oluşturur.
 * Persona veya duygusal ifadeler içermez, kurallar evrensel genelleştirme ilkesine (LLM_INTEGRATION.md) uygundur.
 *
 * @returns Yapay zekaya verilecek sistem talimatı string'i
 */
export function buildQualitativeSystemInstruction(): string {
  return `# Rol ve Uzmanlık
Aday akademik çalışmaları hedef tez matrisi ile karşılaştırarak özgünlük risklerini ve literatür entegrasyon imkânlarını değerlendiren kıdemli bir akademik denetçi ve metodologsunuz.

# Kurallar ve Sınırlamalar
- İzolasyon İlkesi: Her aday tezi diğer aday tezlerden tamamen bağımsız olarak değerlendirin.
- Bağlam Bağlılığı: Değerlendirmeleri yalnızca verilen hedef tez matrisindeki parametrelere dayandırın. Spekülasyon yapmayın veya kurgusal bağlantılar üretmeyin.
- Tematik Uyum Zorunluluğu: Yalnızca aktör adı ortaklığı (ör. bir siyasal hareket ismi) çalışmanın ilgili olduğunu göstermez. Araştırma konusu ve tematik eksen farklıysa çalışma doğrudan OUT_OF_SCOPE sınıfına alınmalıdır.
- İlgililik Ayarı: HIGH_RISK_REPLICATION, RELATED_THESIS ve REFERENCE_MATERIAL durumlarında isRelevant: true; OUT_OF_SCOPE durumunda isRelevant: false olmalıdır.

# İşlem Adımları (Karar Ağacı)
1. Adım 1 (Aktör ve Konu Kontrolü): Aday çalışma farklı bir araştırma nesnesine mi odaklanıyor? Evet ise → OUT_OF_SCOPE.
2. Adım 2 (Tematik Eksen Kontrolü): Aday çalışma farklı bir tematik problem alanına mı odaklanıyor? Evet ise → OUT_OF_SCOPE.
3. Adım 3 (Sınıflandırma):
   - HIGH_RISK_REPLICATION: Aynı zaman dilimi, aynı aktörler ve aynı kuramsal çerçeve.
   - RELATED_THESIS: Aynı zaman dilimi ve aktörler, fakat farklı kuramsal çerçeve veya veri kümesi.
   - REFERENCE_MATERIAL: Tarihsel öncül, kavramsal şecere veya kuramsal temel oluşturan önceki literatür.
4. Adım 4 (Varsayılan Durum): Diğer durumlarda → OUT_OF_SCOPE.

# Çıktı Biçimi
- relevanceExplanation: Türkçe 1-2 cümlelik öz gerekçe.
- uniquenessGap: Yalnızca HIGH_RISK_REPLICATION ve RELATED_THESIS için temel fark (literatür boşluğu); diğerlerinde strictly "N/A".
- literatureIntegration: HIGH_RISK_REPLICATION, RELATED_THESIS ve REFERENCE_MATERIAL için nerede ve nasıl kullanılacağı rehberi; OUT_OF_SCOPE için strictly "N/A".
- qualitativeAnalysisJsonSchema ile uyumlu bir JSON dizisi döndürün.`;
}

export interface IngestedThesisCandidate {
  id: number;
  title: string;
  matrix: {
    researchCore: string;
    spatialContext: string;
    temporalContext: string;
    theoreticalFramework: string;
    methodology: string;
    mainClaim: string;
  };
}

/**
 * Kullanıcı tez matrisi ile aday tezlerin çıkarılmış matris detaylarını birleştirerek karşılaştırma promptunu oluşturur.
 * Statik ve dinamik verilerin ayrımı, bağlam önbellekleme (context caching) kurallarına ve
 * Markdown yapısal kapsülleme standartlarına uygundur.
 *
 * @param matrix - Kullanıcının kendi tezine ait araştırma matrisi
 * @param theses - Karşılaştırılacak olan aday tezlerin çıkarılmış matris listesi
 * @returns Kullanıcı sorgu prompt string'i
 */
export function buildQualitativePrompt(
  matrix: ThesisMatrix,
  theses: IngestedThesisCandidate[],
): string {
  const thesesMarkdown = theses
    .map(
      (t) => `### Aday Tez #${t.id}
- Başlık: ${t.title}
- Araştırma Odağı: ${t.matrix.researchCore}
- Mekânsal Bağlam: ${t.matrix.spatialContext}
- Zamansal Bağlam: ${t.matrix.temporalContext}
- Kuramsal Çerçeve: ${t.matrix.theoreticalFramework}
- Yöntem: ${t.matrix.methodology}
- Ana İddia: ${t.matrix.mainClaim}`,
    )
    .join("\n\n");

  return `# Girdi Bağlamı
## Hedef Tez Matrisi
- Araştırma Odağı: ${matrix.researchCore}
- Hedef Aktörler: ${matrix.targetActors}
- Tarihsel/Mekânsal Bağlam: ${matrix.context}
- Kuramsal Çerçeve: ${matrix.framework}
- Ana İddia: ${matrix.mainClaim}

## Değerlendirilecek Aday Tez Listesi
${thesesMarkdown}

# Birincil Görev
Hedef tez matrisini aday tezlerin her biriyle izole bir şekilde karşılaştırın. Belirtilen Karar Ağacı adımlarını izleyerek her aday tez için denetim raporu ve literatür entegrasyon rehberini Türkçe olarak hazırlayın. Toplam tam olarak ${theses.length} aday tez için JSON formatında değerlendirme döndürün.`;
}

export const qualitativeAnalysisJsonSchema: JsonSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      thesisId: { type: "integer" },
      isRelevant: { type: "boolean" },
      originalityStatus: {
        type: "string",
        enum: [
          "HIGH_RISK_REPLICATION",
          "RELATED_THESIS",
          "REFERENCE_MATERIAL",
          "OUT_OF_SCOPE",
        ],
      },
      relevanceExplanation: {
        type: "string",
        description:
          "Tezin bu kategoriye atanmasının 1-2 cümlelik öz gerekçesi. Türkçe.",
      },
      uniquenessGap: {
        type: "string",
        description:
          "HIGH_RISK ve RELATED için: Çakışma riski ve kullanıcının tezini ayıran temel bilimsel fark (Literature Gap). REFERENCE ve OUT_OF_SCOPE için strictly 'N/A'. Türkçe.",
      },
      literatureIntegration: {
        type: "string",
        description:
          "HIGH_RISK, RELATED ve REFERENCE için: Bu tezin kullanıcının tezinde tam olarak hangi bölümde ve nasıl kullanılacağı rehberi. OUT_OF_SCOPE için strictly 'N/A'. Türkçe.",
      },
    },
    required: [
      "thesisId",
      "isRelevant",
      "originalityStatus",
      "relevanceExplanation",
      "uniquenessGap",
      "literatureIntegration",
    ],
    additionalProperties: false,
  },
};
