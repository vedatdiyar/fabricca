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
  - *Bölüm 4 (Karşılaştırmalı Analiz / Ampirik Tartışma / Sentez):* Farklı hatların, söylemlerin, bulguların veya verilerin kuram ışığında karşılaştırmalı analizini ve tartışmasını yapan 2-3 alt bölüm.
- **Son Bölüm (Sonuç ve Değerlendirme):** Araştırma bulgularının sentezini, hipotezlerin değerlendirilmesini ve literatüre katkıyı içeren nihai bölümdür.

## 3. Metodoloji ve Kaynak Entegrasyonu
- Sosyal ve beşeri bilimlerde yöntem ve birincil kaynakların seçimi Giriş bölümünün alt başlıkları olarak kurgulanır; böylece tezin gövdesi yöntemle şişirilmeden doğrudan kuramsal ve ampirik içeriğe odaklanır.

## 4. Başlık ve İfade Standartları
- **Sadelik ve Hiyerarşik Netlik:** Başlıklar makale özeti veya uzun cümleler yerine kısa, analitik ve akademik kavramlara odaklı olmalıdır.
- **Dil:** Tüm başlıklar ve açıklamalar akıcı ve yüksek düzey akademik Türkçe ile yazılmalıdır.
- **Açıklamalar (description):** Her ana ve alt bölüm için 1-2 cümlelik öz, net akademik açıklamalar yazılmalıdır.

## 5. Katı Sadakat ve Dış Kavram Yasağı (Strict Grounding & Negative Constraints)
- KESİNLİKLE matriste adı geçmeyen hiçbir düşünürü, teorik modeli, kavramı veya alt başlığı dışarıdan eklemeyin / uydurmayın.
- Yalnızca matriste açıkça yer alan analitik kavramlar, ampirik aktörler ve düşünürler üzerinden alt başlıklar türetin.
- Matriste bulunmayan genel geçer kavramları veya harici teorik ekolleri pre-training bilginizden çekip plana ASLA DAHİL ETMEYİN.`,

    workflowSteps: `1. Araştırma problemi ve kuramsal çerçeveden hareketle tezin bilim dalını (academicField) belirleyin.
2. Türkiye lisansüstü tez geleneğine uygun olarak: Giriş (yöntem/materyal alt başlıkları dahil) + 3 Ana Gövde Bölümü + Sonuç ve Değerlendirme mimarisini kurun.
3. Giriş bölümü altına Araştırmanın Problemi/Amacı, Kuramsal Yaklaşım/Hipotez, Yöntem/Birincil Kaynaklar ve Tezin Kurgusu alt başlıklarını ekleyin.
4. 3 Gövde bölümünü (Kuram → Ampirik Süreç → Karşılaştırmalı Sentez) 2-3'er odaklı alt başlıkla yapılandırın.
5. Başlıkları analitik ve sade bir dille formüle edin.`,

    outputFormat: `- Yanıt yalnızca sağlanan JSON şemasına eksiksiz uyan JSON nesnesi olmalıdır.
- Tüm başlıklar ve açıklamalar akademik Türkçe olmalıdır. Şema: {"academicField": string, "sections": [{"title": string, "description": string, "sortOrder": number, "subSections": [{"title": string, "description": string, "sortOrder": number}]}]}`,

    inputContext: `### Araştırma Problemi:
${matrix.subjectProblem}

### Teorik Çerçeve:
${matrix.theoreticalFramework}

### Birincil Materyal:
${matrix.primaryMaterial || "Belirtilmemiş"}

### Metodoloji:
${matrix.methodology}`,

    taskTrigger:
      "Yukarıdaki <context> içeriğindeki tez matrisi verilerini analiz ederek Türkiye lisansüstü tez standartlarına tam uyumlu, sade, akıcı ve KATI SADAKAT (Strict Grounding) kurallarına harfiyen uyan bir taslak tez planını <instructions> kurallarına göre JSON formatında üret.",
  });
}
