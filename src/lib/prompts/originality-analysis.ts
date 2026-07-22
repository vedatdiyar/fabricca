import type { JsonSchema } from "../services/gemini";
import type { ThesisMatrix } from "../types";

/**
 * Akademik denetim ve literatür eleme mekanizması için optimize edilmiş Sistem Talimatı.
 */
export function buildQualitativeSystemInstruction(): string {
  return `# Rol ve Uzmanlık
Siz, hedef tez matrisini aday çalışmalarla karşılaştırarak özgünlük risklerini ve literatür entegrasyon imkânlarını değerlendiren kıdemli bir akademik denetçisiniz.

# Temel Değerlendirme İlkeleri
- İzolasyon: Her aday tezi diğer aday tezlerden tamamen bağımsız değerlendirin.
- Doğrudan İlliyet Aratın: Bir tezin ilgili (isRelevant: true) sayılabilmesi için, hedef tezin ARAŞTIRMA PROBLEMİ, AKTÖRLERİ veya KURAMSAL ÇERÇEVESİ ile doğrudan metodolojik/içeriksel bir bağı olmalıdır. Yalnızca aynı anahtar kelimeleri (örneğin "Kürt meselesi", "Türkiye siyaseti") içermesi bir tezi ilgili KILMAZ.

# Karar Ağacı ve Sınıflandırma
Aday çalışmayı aşağıdaki kurallara göre KESİN olarak tek bir kategoriye atayın:

1. HIGH_RISK_REPLICATION (isRelevant: true):
   - Aynı araştırma konusu/problemi, aynı hedef aktörler, aynı tarihsel dönem VE aynı/benzer kuramsal çerçeve. (Birebir çakışma riski).

2. RELATED_THESIS (isRelevant: true):
   - Hedef tezle BİREBİR AYNI AKTÖR veya BİREBİR AYNI KAVRAMSAL PROBLEM üzerinde çalışan; fakat farklı bir alt döneme, farklı bir coğrafyaya veya farklı bir veri kümesine odaklanan tezler.

3. REFERENCE_MATERIAL (isRelevant: true):
   - Hedef tezin dayandığı kuramsal modelin (örn. Çerçeveleme, Hegemonya) teorik temeli OLAN veya hedef tezin aktörünün DOĞRUDAN TARİHSEL ŞECERESİNİ/ÖNCÜLÜNÜ (örn. DDKO, TİP-Kürt ilişkisi) inceleyen kurucu çalışmalar.
   - UYARI: Genel tarihsel arka plan sunan, genel uluslararası ilişkiler yazıları veya genel Türkiye siyaseti özetleri bu kategoriye GİREMEZ.

4. OUT_OF_SCOPE (isRelevant: false):
   - Yukarıdaki 3 kritere girmeyen DİĞER TÜM ÇALIŞMALAR.
   - Örnekler: Farklı aktörlere odaklanan tezler (CHP, AKP, Devlet Aklı), genel uluslararası boyut analizleri, tamamen farklı dönemsel ve tematik odağa sahip sosyolojik çalışmalar.

# Çıktı Biçimi
- relevanceExplanation: Türkçe 1-2 cümlelik öz gerekçe.
- uniquenessGap: Yalnızca HIGH_RISK_REPLICATION ve RELATED_THESIS için temel bilimsel fark (literatür boşluğu); diğerlerinde strictly "N/A".
- literatureIntegration: HIGH_RISK_REPLICATION, RELATED_THESIS ve REFERENCE_MATERIAL için tezin nerede ve nasıl kullanılacağı rehberi; OUT_OF_SCOPE için strictly "N/A".`;
}

export interface IngestedThesisCandidate {
  id: number;
  title: string;
  matrix: {
    researchCore: string;
    targetActors?: string;
    spatialContext: string;
    temporalContext: string;
    theoreticalFramework: string;
    methodology: string;
    mainClaim: string;
  };
}

/**
 * Kullanıcı tez matrisi ile aday tez listesini karşılaştıran kullanıcı promptunu oluşturur.
 */
export function buildQualitativePrompt(
  matrix: ThesisMatrix,
  theses: IngestedThesisCandidate[],
): string {
  const thesesMarkdown = theses
    .map(
      (t) => `### Aday Tez ID: ${t.id}
- Başlık: ${t.title}
- Araştırma Odağı: ${t.matrix.researchCore}
- Hedef Aktörler / İnceleme Nesnesi: ${t.matrix.targetActors || "Belirtilmemiş"}
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

# Görev
Hedef tez matrisini aday tezlerin her biriyle izole bir şekilde karşılaştırın. 
Sistem talimatındaki katı eleme ve sınıflandırma kurallarını uygulayarak her aday tez için Türkçe değerlendirme raporu hazırlayın. 
Toplam ${theses.length} adet aday tez için, aday tezlerin orijinal ID değerlerini (thesisId) koruyarak tanımlanan JSON şemasına uygun çıktı üretin.`;
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
          "HIGH_RISK ve RELATED için: Çakışma riski ve kullanıcının tezini ayıran temel bilimsel fark. REFERENCE ve OUT_OF_SCOPE için strictly 'N/A'. Türkçe.",
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
