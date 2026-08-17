import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";

export interface OutlineMatrixInput {
  subjectProblem: string;
  theoreticalFramework: string;
  primaryMaterial: string | null;
  methodology: string;
}

/**
 * Builds the standardized PromptPayload for thesis outline generation.
 * Strictly adheres to docs/LLM_INTEGRATION.md.
 *
 * @param matrix - The thesis matrix input data.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildOutlineGenerationPromptPayload(
  matrix: OutlineMatrixInput,
): PromptPayload {
  return buildPromptPayload({
    roleAndExpertise:
      "Siz, Türkiye YÖK Lisansüstü Eğitim Enstitüleri (Sosyal Bilimler Enstitüsü, Fen Bilimleri Enstitüsü) ve uluslararası akademik standartlarda uzmanlaşmış kıdemli bir tez danışmanı ve akademik yapılandırma asistanısınız.",

    primaryTask:
      "Sağlanan tez matrisindeki araştırma problemi, teorik çerçeve, birincil materyal ve metodoloji bilgilerini sentezleyerek tezin bilim dalını tespit edin ve metodolojik açıdan akıcı, sade, organik bağları güçlü bir tez taslak planı (içindekiler hiyerarşisi) oluşturun.",

    rulesAndConstraints: `## 1. Bilim Dalı Tespiti (academicField)
- Matris verilerini analiz ederek tezin ait olduğu temel akademik bilim dalını belirleyin (Örn: "Siyaset Bilimi ve Kamu Yönetimi", "Sosyoloji", "İktisat", "Hukuk", "Bilgisayar Mühendisliği", "Eğitim Bilimleri").

## 2. Bölüm Mimarisi ve Hiyerarşi Standartları (Türkiye YÖK & SBE Standartları)
- **Ana Bölüm Mimarisi:** Giriş + 3 Ana Gövde Bölümü + Sonuç ve Değerlendirme (Toplam 5 Ana Bölüm).
- **Bölüm 1 (Giriş):** Tezin kuramsal ve yöntemsel manifestosudur. Altında araştırmanın problemini, kuramsal yaklaşımını, yöntemini/birincil kaynaklarını ve tezin planını sunan 2 ila 4 odaklanmış alt bölüm (subSections) yer almalıdır.
- **Gövde Bölümleri (Bölüm 2, 3, 4):** Tezin ana kuramsal ve ampirik eksenlerini taşıyan 3 bağımsız ana bölümdür:
  - *Bölüm 2 (Kuramsal Çerçeve):* Konunun teorik temellerini ve kavramsal araçlarını derinlemesine inceleyen 2-3 alt bölüm.
  - *Bölüm 3 (Tarihsel Bağlam / Aktörler / Ampirik Süreç):* Araştırmanın birincil materyal ve aktörlerinin söylemsel/ampirik pratiklerini inceleyen 2-3 alt bölüm.
  - *Bölüm 4 (Karşılaştırmalı Analiz / Karşı-Hegemonya / Sentez):* Farklı hatların, söylemlerin veya verilerin kuram ışığında karşılaştırmalı analizini ve tartışmasını yapan 2-3 alt bölüm.
- **Son Bölüm (Sonuç ve Değerlendirme):** Araştırma bulgularının sentezini, hipotezlerin değerlendirilmesini ve literatüre katkıyı içeren nihai bölümdür.

## 3. Metodoloji ve Kaynak Entegrasyonu
- Sosyal ve beşeri bilimlerde yöntem ve birincil kaynakların seçimi Giriş bölümünün alt başlıkları olarak kurgulanır; böylece tezin gövdesi yöntemle şişirilmeden doğrudan kuramsal ve ampirik içeriğe odaklanır.

## 4. Başlık ve İfade Standartları
- **Sadelik ve Hiyerarşik Netlik:** Başlıklar makale özeti veya uzun cümleler yerine kısa, analitik ve akademik kavramlara odaklı olmalıdır.
- **Dil:** Tüm başlıklar ve açıklamalar akıcı ve yüksek düzey akademik Türkçe ile yazılmalıdır.
- **Açıklamalar (description):** Her ana ve alt bölüm için 1-2 cümlelik öz, net akademik açıklamalar yazılmalıdır.`,

    workflowSteps: `1. Araştırma problemi ve kuramsal çerçeveden hareketle tezin bilim dalını (academicField) belirleyin.
2. Türkiye lisansüstü tez geleneğine uygun olarak: Giriş (yöntem/materyal alt başlıkları dahil) + 3 Ana Gövde Bölümü + Sonuç ve Değerlendirme mimarisini kurun.
3. Giriş bölümü altına Araştırmanın Problemi/Amacı, Kuramsal Yaklaşım/Hipotez, Yöntem/Birincil Kaynaklar ve Tezin Kurgusu alt başlıklarını ekleyin.
4. 3 Gövde bölümünü (Kuram → Ampirik Süreç → Karşılaştırmalı Sentez) 2-3'er odaklı alt başlıkla yapılandırın.
5. Başlıkları analitik ve sade bir dille formüle edin.`,

    outputFormat: `- Yanıt yalnızca sağlanan JSON şemasına eksiksiz uyan JSON nesnesi olmalıdır.
- Tüm başlıklar ve açıklamalar akademik Türkçe olmalıdır.`,

    examples: `<example>
<input>
- Araştırma Problemi: 1990'lar Türkiye'sinde Neoliberal Dönüşüm ve Yerel Yönetimlerin Özerkliği
- Teorik Çerçeve: David Harvey'nin Neoliberalizm Kuramı ve Kentsel Mekânın Yeniden Üretimi
- Birincil Materyal: Belediye Meclis Kararları, Resmî Gazete Tebliğleri ve İmar Raporları
- Metodoloji: Nitel Söylem ve Politika Analizi
</input>
<output>
{
  "academicField": "Siyaset Bilimi ve Kamu Yönetimi",
  "sections": [
    {
      "title": "Giriş",
      "description": "Araştırmanın konusu, problemi, kuramsal-yöntemsel yaklaşımı ve tezin kurgusal yapısı.",
      "sortOrder": 1,
      "subSections": [
        {
          "title": "Araştırmanın Konusu, Problemi ve Amacı",
          "description": "1990'larda yerel yönetimlerin dönüşüm problemi ve araştırmanın temel soruları.",
          "sortOrder": 1
        },
        {
          "title": "Kuramsal Çerçeve ve Temel Hipotezler",
          "description": "David Harvey'nin mekân teorisi ekseninde kurulan hipotezlerin sunumu.",
          "sortOrder": 2
        },
        {
          "title": "Yöntem, Birincil Kaynaklar ve Sınırlılıklar",
          "description": "Nitel söylem analizi yöntemi, belediye meclis kararları ve arşiv materyallerinin kapsamı.",
          "sortOrder": 3
        }
      ]
    },
    {
      "title": "Kuramsal Çerçeve: Neoliberalizm, Devlet ve Kentsel Mekân",
      "description": "Neoliberal yeniden yapılanma, yerel yönetimler ve kentsel rant dinamiklerinin teorik analizi.",
      "sortOrder": 2,
      "subSections": [
        {
          "title": "Neoliberal Devlet Aklı ve Kentsel Mekânın Metalaşması",
          "description": "Harvey'nin sermaye birikim modelleri ışığında kentsel politikalar.",
          "sortOrder": 1
        },
        {
          "title": "Yerel Özerklik ve Merkez-Yerel İlişkileri",
          "description": "Merkezi idare ile yerel otoriteler arasındaki yetki aktarımlarının kuramsal boyutları.",
          "sortOrder": 2
        }
      ]
    },
    {
      "title": "1990'lar Türkiye'sinde Yerel Yönetimlerin Kurumsal ve Hukuki Dönüşümü",
      "description": "Dönemin yasal mevzuatı, belediye kararları ve yerel hizmetlerin piyasalaşma pratikleri.",
      "sortOrder": 3,
      "subSections": [
        {
          "title": "Mevzuat Değişiklikleri ve Özelleştirme Uygulamaları",
          "description": "Belediye hizmetlerinin piyasaya açılmasına dair yasal çerçevenin analizi.",
          "sortOrder": 1
        },
        {
          "title": "Belediye Meclislerinde Kentsel Rant ve İmar Kararları",
          "description": "Birincil arşiv belgeleri üzerinden meclis kararlarının ampirik dökümü.",
          "sortOrder": 2
        }
      ]
    },
    {
      "title": "Kentsel Politikaların Söylemsel Analizi ve Özerklik Çıkmazı",
      "description": "Siyasal aktörlerin söylemleri ile uygulama arasındaki gerilimlerin karşılaştırmalı analizi.",
      "sortOrder": 4,
      "subSections": [
        {
          "title": "Yerel Siyasette 'Hizmet' ve 'Piyasa' Söyleminin İnşası",
          "description": "Nitel söylem analizi bulgularının kuramsal kavramlarla karşılaştırılması.",
          "sortOrder": 1
        },
        {
          "title": "Merkezi Denetim Karşısında Yerel Özerklik Kapasitesi",
          "description": "Yerel aktörlerin özerklik talepleri ile merkezi vesayet arasındaki güç ilişkileri.",
          "sortOrder": 2
        }
      ]
    },
    {
      "title": "Sonuç ve Değerlendirme",
      "description": "Araştırma bulgularının sentezi, hipotezlerin doğrulanması ve literatüre katkı.",
      "sortOrder": 5,
      "subSections": []
    }
  ]
}
</output>
</example>`,

    inputContext: `### Araştırma Problemi:
${matrix.subjectProblem}

### Teorik Çerçeve:
${matrix.theoreticalFramework}

### Birincil Materyal:
${matrix.primaryMaterial || "Belirtilmemiş"}

### Metodoloji:
${matrix.methodology}`,

    taskTrigger:
      "Yukarıdaki <context> içeriğindeki tez matrisi verilerini analiz ederek Türkiye lisansüstü tez standartlarına tam uyumlu, sade ve akıcı bir taslak tez planını <instructions> kurallarına göre JSON formatında üret.",
  });
}
