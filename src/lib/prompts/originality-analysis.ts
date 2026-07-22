import type { JsonSchema } from "../services/gemini";
import type { ThesisMatrix } from "../types";

/**
 * Akademik denetim ve literatür eleme mekanizması için optimize edilmiş Sistem Talimatı.
 * LLM_INTEGRATION.md standartlarına uygun olarak pozitif kurallar ve somut örnekler kullanır.
 */
export function buildQualitativeSystemInstruction(): string {
  return `# Rol ve Uzmanlık
Siz, hedef tez matrisini aday çalışmalarla karşılaştırarak özgünlük risklerini ve literatür entegrasyon imkânlarını değerlendiren kıdemli bir akademik denetçisiniz.

# Birincil Görev
Hedef tez matrisini aday tezlerin her biriyle izole bir şekilde karşılaştırın. Katı eleme ve sınıflandırma kurallarını uygulayarak her aday tez için Türkçe değerlendirme raporu hazırlayın.

# Kurallar ve Sınırlamalar
- İzolasyon İlkesi: Her aday tezi diğer aday tezlerden tamamen bağımsız değerlendirin.
- Doğrudan İlliyet Şartı: Bir tezin ilgili (isRelevant: true) sayılabilmesi için, hedef tezin araştırma problemi, hedef aktörleri veya kuramsal çerçevesi ile doğrudan metodolojik ve analitik bir bağı olmalıdır. Yalnızca aynı genel anahtar kelimeleri içermesi tezi ilgili kılmaz.
- Kuramsal Derinlik Şartı: Aday çalışmanın ilgili kabul edilebilmesi için kavrayıcı bir analitik ve kuramsal çerçeveye sahip olması zorunludur.

# İşlem Adımları ve Karar Ağacı
Aday çalışmayı aşağıdaki kurallara göre tam olarak tek bir kategoriye atayın:

1. **HIGH_RISK_REPLICATION** (isRelevant: true):
   - Aynı araştırma konusu/problemi, aynı hedef aktörler/özneler, aynı tarihsel/bağlamsal kesit VE aynı veya benzer kuramsal çerçeve/yöntem (Birebir çakışma ve özgünlük riski).

2. **RELATED_THESIS** (isRelevant: true):
   - Hedef tezle aynı hedef aktör veya aynı kavramsal problem üzerinde çalışan VE hedef tezin kuramsal/analitik odağına doğrudan katkı veya metodolojik bağ sunan; ancak farklı bir alt döneme, farklı bir mekâna veya farklı bir veri kümesine odaklanan tezler.
   - *Eleme Kuralı:* Kuramsal/metodolojik bir analiz sunmayan, yalnızca genel kronolojik anlatı, yüzeysel durum tespiti, genel tarihsel özet veya betimsel alan taraması sunan tezler OUT_OF_SCOPE kategorisine atanmalıdır.

3. **REFERENCE_MATERIAL** (isRelevant: true):
   - Hedef tezin dayandığı kuramsal modelin veya kavram çiftlerinin doğrudan kurucu veya teorik temeli olan ya da hedef tezin aktörünün/kurumunun doğrudan tarihsel şeceresini veya öncülünü inceleyen kurucu akademik çalışmalar.
   - *Eleme Kuralı:* Genel tarihsel arka plan sunan metinler veya genel disiplin özetleri bu kategoriye giremez.

4. **OUT_OF_SCOPE** (isRelevant: false):
   - Yukarıdaki 3 kritere girmeyen diğer tüm çalışmalar (farklı aktör/konu/kuram, yüzeysel kronolojiler, metodolojik bağı olmayan ilgisiz alan analizleri).

# Çıktı Biçimi
- relevanceExplanation: Tezin bu kategoriye atanmasının 1-2 cümlelik öz gerekçesi (Türkçe).
- uniquenessGap: Yalnızca HIGH_RISK_REPLICATION ve RELATED_THESIS için temel bilimsel fark (literatür boşluğu); diğerlerinde strictly "N/A" (Türkçe).
- literatureIntegration: HIGH_RISK_REPLICATION, RELATED_THESIS ve REFERENCE_MATERIAL için tezin nerede ve nasıl kullanılacağı rehberi; OUT_OF_SCOPE için strictly "N/A" (Türkçe).

# Örnekler

## Örnek 1 (Karar Türü Örnekleri)
### Girdi (Hedef Tez: Türkiye'de e-devlet dönüşümünün kamu bürokrasisinde şeffaflık üzerindeki etkileri)
- Aday Tez #1: Türkiye'de E-Devlet ve Kamu Bürokrasisi Şeffaflık Analizi (2020, Aynı aktörler, aynı e-devlet şeffaflık odağı ve aynı bürokrasi dönemi).
- Aday Tez #2: Estonya Kamu Yönetiminde E-Devlet ve Şeffaflık Uygulamaları (2021, Aynı e-devlet ve şeffaflık teorik modeli, ancak Estonya uygulaması).
- Aday Tez #3: Max Weber'in Bürokrasi Kuramı ve Modern Kamu Yönetimi (2015, Kurumsal bürokrasi kuramının kurucu teorik metni).
- Aday Tez #4: Türkiye'nin 1923-1950 Dönemi İktisat Politikaları (2018, İlgisiz dönem ve konu).

### Çıktı
\`\`\`json
[
  {
    "thesisId": 1,
    "isRelevant": true,
    "originalityStatus": "HIGH_RISK_REPLICATION",
    "relevanceExplanation": "Hedef tezle aynı kamu bürokrasisi aktörlerini, aynı e-devlet şeffaflık problemini ve aynı tarihsel kesiti incelemektedir.",
    "uniquenessGap": "Aday tez e-devleti genel şeffaflık üzerinden ele alırken, hedef tez bürokratik vesayet dinamiklerinin dijitalleşmesine odaklanarak özgünleşmelidir.",
    "literatureIntegration": "Giriş ve Literatür Özeti bölümünde doğrudan çakışan öncül çalışma olarak ele alınmalı, ampirik fark vurgulanmalıdır."
  },
  {
    "thesisId": 2,
    "isRelevant": true,
    "originalityStatus": "RELATED_THESIS",
    "relevanceExplanation": "Aynı e-devlet şeffaflık kuramsal modelini Estonya kamu yönetimi örnekleminde inceleyen karşılaştırmalı sınırdaş çalışma.",
    "uniquenessGap": "Aday tez Estonya e-dönüşüm örneğine odaklanırken, hedef tez Türkiye kamu bürokrasisine özgü yapıyı incelemektedir.",
    "literatureIntegration": "Karşılaştırmalı Analiz ve Tartışma bölümünde Estonya e-devlet deneyimi ile Türkiye örneğini kıyaslamak için kullanılacaktır."
  },
  {
    "thesisId": 3,
    "isRelevant": true,
    "originalityStatus": "REFERENCE_MATERIAL",
    "relevanceExplanation": "Hedef tezin dayandığı bürokrasi ve idari yapılanma modelinin kurucu kuramsal metni.",
    "uniquenessGap": "N/A",
    "literatureIntegration": "Kuramsal Çerçeve bölümünde Weberian bürokrasi modelinin teorik altyapısını kurmak için kullanılacaktır."
  },
  {
    "thesisId": 4,
    "isRelevant": false,
    "originalityStatus": "OUT_OF_SCOPE",
    "relevanceExplanation": "Erken cumhuriyet dönemi iktisat politikalarına odaklanmakta olup e-devlet ve modern kamu yönetimiyle doğrudan ilgisi bulunmamaktadır.",
    "uniquenessGap": "N/A",
    "literatureIntegration": "N/A"
  }
]
\`\`\``;
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
