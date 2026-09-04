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
- Matris verilerini analiz ederek tezin ait olduğu temel akademik bilim dalını kesin olarak belirleyin (Örn: "Siyaset Bilimi ve Kamu Yönetimi", "Sosyoloji", "İktisat", "Hukuk", "Uluslararası İlişkiler", "Tarih").

## 2. Bölüm Mimarisi ve Hiyerarşi Standartları (Türkiye YÖK & Sosyal Bilimler Enstitüsü Standartları)
- **Ana Bölüm Mimarisi:** Giriş + 3 Ana Gövde Bölümü + Sonuç ve Değerlendirme (Toplam 5 Ana Bölüm).
- **Bölüm 1 (Giriş):** Tezin kuramsal ve yöntemsel manifestosudur. Sosyal bilimler lisansüstü tez geleneğine uygun olarak şu 3 ila 5 odaklanmış alt bölümü (subSections) içermelidir:
  - Araştırmanın Konusu, Problemi ve Amacı
  - Kuramsal Yaklaşım ve Temel Hipotezler / Öncüller
  - Araştırma Yöntemi, Analitik Sorular ve Birincil Korpus / Veri Kaynakları
  - Araştırmanın Kapsamı, Dönemselleştirmesi ve Sınırlılıkları
  - Tezin Kurgusu ve Bölüm Planı
- **Gövde Bölümleri (Bölüm 2, 3, 4 - Epistemolojik Üçlü Katman):** Tezin kuramsal, bağlamsal ve ampirik eksenlerini taşıyan 3 dengeli ana bölümdür:
  - *Bölüm 2 (Kuramsal / Kavramsal Çerçeve):* Konunun teorik omurgasını, kavramsal araçlarını, model ve dinamiklerini derinlemesine inceleyen 2 ila 4 odaklanmış alt bölüm.
  - *Bölüm 3 (Tarihsel, Siyasal ve Kurumsal Bağlam / Aktörler ve Yapısal Zemin):* İncelenen dönemin tarihsel/yapısal arka planını, kurumsal dinamiklerini ve incelenen ana aktörlerin/hatların örgütsel gelişimini ortaya koyan 2 ila 4 odaklanmış alt bölüm. (Kural: Bu bölüm ampirik verilerin ve metinlerin içine doğduğu tarihsel/kurumsal zemini inşa eder; henüz doğrudan mikro metin/söylem analizine girilmez, zemin hazırlanır).
  - *Bölüm 4 (Ampirik Analiz, Karşılaştırmalı Bulgular ve Kuramsal Sentez):* Tezin birincil materyallerinin (arşiv belgeleri, metinler, kurumsal yayınlar, ampirik veriler veya dönemsel momentler) yöntem protokolü ışığında derinlemesine ve karşılaştırmalı olarak incelendiği ana gövde bölümüdür (3 ila 4 alt bölüm):
    - Eğer tez ampirik dönemlemelere/momentlere, vaka karşılaştırmalarına veya tematik kategorilere dayanıyorsa, her bir ana dönem/vaka/kategori için müstakil birer alt başlık açılmalıdır.
    - **Zorunlu Kuramsal Sentez Kuralı:** Bu ampirik bölümün nihai alt başlığı KESİNLİKLE *"Bulguların Kuramsal Yorumu ve Sentezi"* (veya bulguların Bölüm 1'deki teorik model/spektrum ile eşlenmesi ve tartışılması) olmalıdır. Böylece ampirik bulgular ile kuramsal çerçeve arasındaki bağ doğrudan ampirik analizin sonunda kapatılır.
- **Son Bölüm (Sonuç ve Değerlendirme):** Araştırma bulgularının genel sentezini, hipotezlerin ve araştırma sorularının nihai değerlendirilmesini, literatüre özgün katkıyı ve gelecekteki araştırmalar için önerileri içeren 2 ila 3 alt bölüm.

## 3. Metodoloji ve Kaynak Entegrasyonu
- Sosyal ve beşeri bilimlerde yöntem, veri toplama teknikleri ve birincil kaynakların seçimi Giriş bölümünün alt başlıkları olarak kurgulanır; böylece tezin gövdesi yöntemle şişirilmeden doğrudan kuramsal, bağlamsal ve ampirik içeriğe odaklanır.

## 4. Başlık ve İfade Standartları
- **Sadelik ve Hiyerarşik Netlik:** Başlıklar makale özeti veya uzun cümleler yerine kısa, analitik ve akademik kavramlara odaklı olmalıdır.
- **Dil:** Tüm başlıklar ve açıklamalar akıcı, hatasız ve yüksek düzey akademik Türkçe ile yazılmalıdır.
- **Açıklamalar (description):** Her ana ve alt bölüm için 1-2 cümlelik öz, net akademik açıklamalar yazılmalıdır.

## 5. Katı Sadakat ve Dış Kavram Yasağı (Strict Grounding & Leakage Shield)
- KESİNLİKLE matriste adı geçmeyen hiçbir düşünürü, teorik modeli, kavramı veya alt başlığı dışarıdan eklemeyin / uydurmayın.
- Yalnızca matriste açıkça yer alan analitik kavramlar, ampirik aktörler, tarihsel momentler ve düşünürler üzerinden alt başlıklar türetin.
- Matriste bulunmayan genel geçer kavramları veya harici teorik ekolleri pre-training bilginizden çekip plana ASLA DAHİL ETMEYİN.`,

    workflowSteps: `1. Araştırma problemi ve kuramsal çerçeveden hareketle tezin bilim dalını (academicField) belirleyin.
2. Türkiye lisansüstü tez geleneğine uygun olarak: Giriş (yöntem/materyal alt başlıkları dahil) + 3 Ana Gövde Bölümü (Kuram → Bağlam/Aktörler → Ampirik Analiz ve Kuramsal Sentez) + Sonuç ve Değerlendirme mimarisini kurun.
3. Giriş bölümü altına Araştırmanın Problemi/Amacı, Kuramsal Yaklaşım/Hipotezler, Yöntem/Birincil Korpus ve Tezin Kurgusu alt başlıklarını ekleyin.
4. 3 Gövde bölümünü (Kuram: 2-3 alt başlık; Tarihsel/Kurumsal Bağlam: 2-3 alt başlık; Ampirik Analiz ve Kuramsal Sentez: 3-4 alt başlık) yapılandırın. Ampirik bölümün son alt başlığını mutlaka kuramsal senteze/eşlemeye ayırın.
5. Başlıkları analitik, sade ve duru bir akademik dille formüle edin.`,

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
      "Yukarıdaki <context> içeriğindeki tez matrisi verilerini analiz ederek Türkiye Sosyal Bilimler Enstitüsü tez standartlarına tam uyumlu, kuram-bağlam-analiz dengesini gözeten, sade, akıcı ve KATI SADAKAT (Strict Grounding) kurallarına harfiyen uyan bir taslak tez planını <instructions> kurallarına göre JSON formatında üret.",
  });
}
