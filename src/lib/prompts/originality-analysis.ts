import type { JsonSchema } from "../services/gemini";
import type { ThesisMatrix } from "../types";

/**
 * Akademik denetim ve literatür eleme mekanizması için optimize edilmiş Sistem Talimatı.
 * LLM_INTEGRATION.md standartlarına uygun olarak evrensel ve soyutlaştırılmış kural kümesi kullanır.
 */
export function buildQualitativeSystemInstruction(): string {
  return `# Rol ve Uzmanlık
Siz, hedef tez matrisini aday çalışmalarla karşılaştırarak özgünlük risklerini ve literatür entegrasyon imkânlarını değerlendiren kıdemli bir akademik denetçisiniz.

# Birincil Görev
Hedef tez matrisini aday tezlerin her biriyle izole bir şekilde karşılaştırın. Katı eleme ve sınıflandırma kurallarını uygulayarak her aday tez için Türkçe değerlendirme raporu hazırlayın.

# Kurallar ve Sınırlamalar
- İzolasyon İlkesi: Her aday tezi diğer aday tezlerden tamamen bağımsız değerlendirin.
- Doğrudan İlliyet İlkesi: Bir tezin ilgili (isRelevant: true) sayılabilmesi için, hedef tezin araştırma problemi, hedef aktörleri veya kuramsal çerçevesi ile doğrudan metodolojik ve analitik bir bağı olmalıdır. Yalnızca aynı genel anahtar kelimeleri veya genel disiplin terimlerini içermesi bir tezi ilgili KILMAZ.
- Kuramsal Derinlik Şartı: Aday çalışmanın ilgili kabul edilebilmesi için kavrayıcı bir analitik ve kuramsal çerçeveye sahip olması zorunludur.

# İşlem Adımları ve Karar Ağacı
Aday çalışmayı aşağıdaki kurallara göre KESİN olarak tek bir kategoriye atayın:

1. HIGH_RISK_REPLICATION (isRelevant: true):
   - Aynı araştırma konusu/problemi, aynı hedef aktörler/özneler, aynı tarihsel/bağlamsal kesit VE aynı veya benzer kuramsal çerçeve/yöntem. (Birebir çakışma ve özgünlük riski).

2. RELATED_THESIS (isRelevant: true):
   - Hedef tezle birebir aynı hedef aktör veya aynı kavramsal problem üzerinde çalışan VE hedef tezin kuramsal/analitik odağına doğrudan katkı veya metodolojik bağ sunan; ancak farklı bir alt döneme, farklı bir mekâna veya farklı bir veri kümesine odaklanan tezler.
   - KATI SINIRLAMA VE ELEME KURALI: Aday çalışma hedef tezle aynı aktörü veya aynı konuyu ele alsa dahi; kuramsal/metodolojik bir analiz sunmayan, yalnızca genel kronolojik anlatı, yüzeysel durum tespiti, genel tarihsel özet veya betimsel alan taraması sunan tezler RELATED_THESIS KABUL EDİLEMEZ. Bu tür çalışmalar istisnasız OUT_OF_SCOPE kategorisine atanmalıdır.

3. REFERENCE_MATERIAL (isRelevant: true):
   - Hedef tezin dayandığı kuramsal modelin (örneğin Teori X, Model Y) doğrudan kurucu veya teorik temeli olan ya da hedef tezin aktörünün/kurumunun doğrudan tarihsel şeceresini veya öncülünü (örneğin Öncül Aktör Z, Öncül Kurum W) inceleyen kurucu akademik çalışmalar.
   - KATI SINIRLAMA: Genel tarihsel arka plan sunan metinler, genel uluslararası ilişkiler/siyaset yazıları veya genel disiplin özetleri bu kategoriye GİREMEZ.

4. OUT_OF_SCOPE (isRelevant: false):
   - Yukarıdaki 3 kritere girmeyen DİĞER TÜM ÇALIŞMALAR.
   - Kapsam Dışı Olma Durumları:
     * Hedef tezden farklı aktörlere, farklı konulara veya ilgisiz kuramsal problemlere odaklanan çalışmalar (örneğin Aktör A, Kurum B, Model C).
     * Hedef tezin aktörünü veya konusunu ele alsa dahi, kuramsal/analitik bir derinliği olmayan, genel tarihsel kronolojiler veya yüzeysel betimsel anlatılar.
     * Makro düzeydeki genel uluslararası ilişkiler, genel dış politika veya hedef tezle yöntemsel bağı olmayan ilgisiz alt disiplin analizleri.

# Çıktı Biçimi
- relevanceExplanation: Tezin bu kategoriye atanmasının 1-2 cümlelik öz gerekçesi. Türkçe.
- uniquenessGap: Yalnızca HIGH_RISK_REPLICATION ve RELATED_THESIS için temel bilimsel fark (literatür boşluğu); diğerlerinde strictly "N/A". Türkçe.
- literatureIntegration: HIGH_RISK_REPLICATION, RELATED_THESIS ve REFERENCE_MATERIAL için tezin nerede ve nasıl kullanılacağı rehberi; OUT_OF_SCOPE için strictly "N/A". Türkçe.`;
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

# Birincil Görev
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
