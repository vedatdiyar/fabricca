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
- **Bölüm 1 (Giriş):** Tezin okuyucuyu konuya hazırlayan kısa ve toplayıcı giriş bölümüdür. En fazla 3 odaklanmış alt bölüm (subSections) içerir:
  - Araştırmanın problemi, amacı, soruları ve önemi bir arada
  - Yöntem ve incelenen kaynaklara kısa genel bakış (ayrıntı gövde bölümlerine bırakılır)
  - Araştırmanın kapsamı, sınırlılıkları ve bölüm planı bir arada
  - (Kural: Kuramsal tartışma Giriş bölümüne konulmaz; kuramsal çerçeve Bölüm 2'ye bırakılır).
- **Gövde Bölümleri (Bölüm 2, 3, 4 - Epistemolojik Üçlü Katman):** Tezin kuramsal, bağlamsal ve ampirik eksenlerini taşıyan 3 dengeli ana bölümdür:
  - *Bölüm 2 (Kuramsal / Kavramsal Çerçeve):* Konunun teorik omurgasını, kavramsal araçlarını, model ve dinamiklerini derinlemesine inceleyen 2 ila 4 odaklanmış alt bölüm.
  - *Bölüm 3 (Tarihsel, Siyasal ve Kurumsal Bağlam / Aktörler ve Yapısal Zemin):* İncelenen dönemin tarihsel/yapısal arka planını, kurumsal dinamiklerini ve incelenen ana aktörlerin/hatların örgütsel gelişimini ortaya koyan 2 ila 4 odaklanmış alt bölüm. (Kural: Bu bölüm ampirik verilerin ve metinlerin içine doğduğu tarihsel/kurumsal zemini inşa eder; henüz doğrudan mikro metin/söylem analizine girilmez, zemin hazırlanır).
  - *Bölüm 4 (Ampirik Analiz ve Karşılaştırmalı Bulgular):* Tezin birincil kaynaklarının, ampirik verilerinin veya arşiv belgelerinin yöntem protokolü ışığında derinlemesine ve karşılaştırmalı olarak incelendiği ana gövde bölümüdür (3 ila 4 alt bölüm). Matristeki methodology ve primaryMaterial girdilerinin yapısına göre şu 3 evrensel araştırma deseninden birine tam sadakatle uyarlanmalıdır:
    - **1. Kronolojik / Dönemsel Desen:** Eğer birincil malzeme veya yöntem belirgin tarih aralıklarına, tarihsel evrelere veya kurumsal dönemlere dayanıyorsa; alt başlıklar yapay ve dar teorik etiketlerden KESİNLİKLE arındırılmalı, doğrudan tarih aralığı ve incelenen olgunun kendisiyle formüle edilmelidir.
    - **2. Karşılaştırmalı Vaka / Aktör Deseni:** Eğer araştırma farklı aktör hatları, ülkeler, kurumlar veya örneklem gruplarının karşılaştırmasına dayanıyorsa; alt başlıklar sırasıyla her bir vaka/aktör eksenine ayrılmalıdır.
    - **3. Tematik Analiz Deseni:** Eğer araştırma kronolojik değil tematik kategorilere dayanıyorsa; alt başlıklar araştırmanın ana tematik boyutlarını sırayla ele almalıdır.
    - **Zorunlu İkili Kapanış Kuralı:** Bu ampirik bölüm bulgu artı değerlendirme olarak kapanır. Sondan bir önceki alt bölüm vaka, aktör, dönem veya tema eksenleri arasındaki karşılaştırmayı taşır; son alt bölüm ise bu karşılaştırmanın matristeki kuramsal çerçeve ile değerlendirilmesini taşır. İki başlık da matristeki kavram ve eksen adlarıyla somut formüle edilir; genel etiket niteliğinde başlık kullanılmaz. Böylece ampirik bulgular ile kuramsal çerçeve arasındaki bağ doğrudan ampirik analizin sonunda kapatılır.
- **Son Bölüm (Sonuç ve Değerlendirme):** Araştırma bulgularının genel sentezini, hipotezlerin ve araştırma sorularının nihai değerlendirilmesini, literatüre özgün katkıyı ve gelecekteki araştırmalar için önerileri içeren 2 ila 3 alt bölüm.

## 3. Metodoloji ve Kaynak Entegrasyonu
- Sosyal ve beşeri bilimlerde yöntem, veri toplama teknikleri ve birincil kaynakların seçimi Giriş bölümünün alt başlıkları olarak kurgulanır; böylece tezin gövdesi yöntemle şişirilmeden doğrudan kuramsal, bağlamsal ve ampirik içeriğe odaklanır.

## 4. Başlık ve İfade Standartları
- **Sadelik ve Hiyerarşik Netlik:** Başlıklar makale özeti veya uzun cümleler yerine kısa, analitik ve akademik kavramlara odaklı olmalıdır.
- **Dil:** Tüm başlıklar ve açıklamalar akıcı, hatasız ve yüksek düzey akademik Türkçe ile yazılmalıdır.
- **Jargon Yasağı ve Kavram Sadakati:** Başlıklarda disiplin dışından ödünç jargon kullanılmaz; matriste geçen kuramsal ve analitik kavramlar aynen korunur. Gereken yerde terimin yalın Türkçe karşılığı tercih edilir.
- **Açıklamalar (description):** Her ana ve alt bölüm için 1-2 cümlelik öz, net akademik açıklamalar yazılmalıdır.

## 5. Katı Sadakat ve Dış Kavram Yasağı (Strict Grounding & Leakage Shield)
- KESİNLİKLE matriste adı geçmeyen hiçbir düşünürü, teorik modeli, kavramı veya alt başlığı dışarıdan eklemeyin / uydurmayın.
- Yalnızca matriste açıkça yer alan analitik kavramlar, ampirik aktörler, tarihsel dönemler ve düşünürler üzerinden alt başlıklar türetin.
- Matriste bulunmayan genel geçer kavramları veya harici teorik ekolleri pre-training bilginizden çekip plana ASLA DAHİL ETMEYİN.`,

    workflowSteps: `1. Araştırma problemi ve kuramsal çerçeveden hareketle tezin bilim dalını (academicField) belirleyin.
2. Türkiye lisansüstü tez geleneğine uygun olarak: Giriş (en fazla 3 alt bölüm) + 3 Ana Gövde Bölümü (Kuram → Bağlam/Aktörler → Ampirik Analiz ve Karşılaştırmalı Bulgular) + Sonuç ve Değerlendirme mimarisini kurun.
3. Giriş bölümü altına problem/amaç/soru/önem, yöntem/incelenen kaynaklara genel bakış ve kapsam/sınırlılık/bölüm planı olmak üzere en fazla 3 alt başlık ekleyin.
4. 3 Gövde bölümünü (Kuram: 2-3 alt başlık; Tarihsel/Kurumsal Bağlam: 2-3 alt başlık; Ampirik Analiz ve Karşılaştırmalı Bulgular: 3-4 alt başlık) yapılandırın. Ampirik bölümün son iki alt başlığını karşılaştırma ve kuramsal değerlendirme olarak somut formüle edin.
5. Başlıkları analitik, sade ve duru bir akademik dille formüle edin; jargon kullanmayın ancak matristeki akademik kavramları koruyun.`,

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
