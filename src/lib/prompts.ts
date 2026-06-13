import type { JsonSchema } from "./gemini";
import type { AxesOption } from "./types";

// ============================================================================
// STEP 1: Tez Matrisi Akademik Zenginleştirme (Matrix Enhancement)
// ============================================================================

export const enhancedThesisSchema: JsonSchema = {
  type: "object",
  properties: {
    academicStudyTitle: { type: "string" },
    literatureResearchQuestion: { type: "string" },
    refinedThesisClaim: { type: "string" },
    conceptualTheoreticalInfrastructure: { type: "string" },
    academicMethodologyDesign: { type: "string" },
    historicalSpatialLimits: { type: "string" },
  },
  required: [
    "academicStudyTitle",
    "literatureResearchQuestion",
    "refinedThesisClaim",
    "conceptualTheoreticalInfrastructure",
    "academicMethodologyDesign",
    "historicalSpatialLimits",
  ],
};

/**
 * Gemini 3 Core ilkelerine uygun hale getirilmiş Sistem Talimatı
 */
export const MATRIX_ENHANCEMENT_SYSTEM_INSTRUCTION = `
<role>
Sen lisansüstü düzeyde akademik danışmanlık yapan kıdemli bir akademisyen ve metodologsun. Ham fikirleri, özünü bozmadan elit ve yayınlanabilir bilimsel metinlere dönüştürürsün.
</role>

<instructions>
1. Girdi olarak verilen ham tez matrisindeki her bir alanı analiz et.
2. Öğrencinin ham dilini, uluslararası hakemli dergilerde kabul görecek düzeyde, kavramsal derinliği olan olgun bir akademik düzyazıya (academic prose) dönüştür.
3. Her alanı, yapısal ve anlamsal açıdan tam bir paragraf bütünlüğünde zenginleştirerek JSON yapısındaki ilgili alanlara eşitle.
</instructions>

<constraints>
- Doğrudan ve net ol; metaforik, edebi veya aşırı süslü dilden kaçın. Elit bir akademik Türkçe kullan.
- Muhafazakar Metodoloji İlkesi: Ham girdideki kuramsal ve metodolojik çerçeveye kesinlikle sadık kal. Öğrencinin açıkça belirtmediği veya ima etmediği radikal teorik makas değişiklikleri (örn: Marksist okuma, söylem analizi, post-yapısalcılık vb.) ekleme. Sadece var olanı olgunlaştır.
- Zaman ve Bilgi Sınırı: Şu anki yılın 2026 olduğunu ve bilgi kesinti tarihinin Ocak 2025 olduğunu varsayarak güncel literatür dengesini gözet.
</constraints>

<output_format>
Yalnızca tanımlanan enhancedThesisSchema yapısına tam uyumlu, geçerli bir JSON nesnesi döndür. JSON dışında hiçbir açıklama metni, giriş veya çıkış cümlesi ekleme.
</output_format>
`;

/**
 * Anchor Context ve Yapısal Hiyerarşi kurallarına göre güncellenmiş Kullanıcı Promptu
 */
export function buildMatrixEnhancementPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  methodology: string;
  theoreticalFramework: string;
  historicalSpatialLimits: string;
}): string {
  return `
<context>
Öğrencinin ham/gündelik dille hazırladığı tez matrisi verileri aşağıdadır:
- Başlık: ${params.studyTitle}
- Soru: ${params.researchQuestion}
- Temel İddia: ${params.mainClaim}
- Yöntem: ${params.methodology}
- Kuramsal Çerçeve: ${params.theoreticalFramework}
- Sınırlılıklar: ${params.historicalSpatialLimits}
</context>

<task>
Yukarıda <context> içinde sağlanan ham verileri, sistem talimatındaki kurallara göre zenginleştirerek aşağıdaki hedef alanları doldur:
1. academicStudyTitle (Kavramsal zenginliği olan başlık)
2. literatureResearchQuestion (Teorik değişkenleri içeren araştırma sorusu)
3. refinedThesisClaim (Literatürle diyaloğa giren temel sav/hipotez)
4. conceptualTheoreticalInfrastructure (Kuramsal mercekleri açıklayan akademik paragraf)
5. academicMethodologyDesign (Belirtilen yönteme sadık kalmış araştırma tasarımı)
6. historicalSpatialLimits (Zaman ve coğrafi kapsamı gerekçelendiren sınırlılıklar)
</task>

<final_instruction>
Based on the information provided above, generate the JSON response now.
</final_instruction>
`;
}

// ============================================================================
// STEP 2: Sorgu Çıkarma (Query Extraction)
// ============================================================================

export const queryExtractionSchema: JsonSchema = {
  type: "object",
  properties: {
    tavilyQueries: {
      type: "array",
      items: { type: "string" },
      description: "Exactly 5 factual or historical queries in Turkish.",
    },
    keywords: {
      type: "array",
      items: { type: "string" },
      description:
        "Exactly 5 core English keywords in their absolute root/base form (e.g., 'union', 'private', 'globe'). No suffixes, no derivations.",
    },
  },
  required: ["tavilyQueries", "keywords"],
};

/**
 * Gemini 3 ve Ajan Tipi İş Akışlarına Uygun Hale Getirilmiş Sistem Talimatı
 */
export const QUERY_EXTRACTION_SYSTEM_INSTRUCTION = `
<role>
Sen akademik bilişim, bilgi erişimi (information retrieval) ve doğal dil işleme alanlarında uzman bir veri mühendisisin. Akademik metinleri tarayarak arama motorları için en optimize sorguları ve morfolojik kök kelimeleri türetirsin.
</role>

<instructions>
Cevap üretmeden önce içsel olarak (internal thinking) şu 3 adımlı ajan planını işlet:
1. **Analiz**: Sağlanan zenginleştirilmiş tez matrisindeki en baskın kavramları, tarihsel dönüm noktalarını ve kurumsal odakları tespit et.
2. **Üretim**: İnternet doğrulaması için 5 adet Türkçe olgusal arama sorgusu ve literatür taraması için 5 adet İngilizce kök kelime tasarla.
3. **Doğrulama ve Filtreleme (Self-Validation)**: Ürettiğin kelimeleri morfolojik olarak denetle; ek almış, türetilmiş (-ization, -ism, -ment vb.) veya tırnak içine alınmış kelimeleri eleyerek en ham sözlük köküne (lemma/base form) indirge. Tam olarak 5'er adet olduklarından emin ol.
</instructions>

<constraints>
- Sayı Kısıtlaması: "tavilyQueries" ve "keywords" listelerinin her ikisi de istisnasız TAM 5 adet eleman içermelidir. Ne eksik ne fazla.
- Kesin Kök Kelime Kuralı (Strict Lemma Constraint): İngilizce anahtar kelimeler hiçbir yapım veya çekim eki almamış, türetilmemiş en yalın kök (base/root form) olmak zorundadır. (Örn: "globalization" yerine "global" veya "globe", "privatization" yerine "private", "institutionalism" yerine "institute" veya "institution"). Özel karakter veya tırnak işareti kullanma.
- Determinizm: Varyasyonlu, yaratıcı veya tezin odağı dışındaki dolaylı kavramlar yerine; matristeki en doğrudan, jenerik ve baskın kavramları seçerek tam tutarlı ve deterministik bir çıktı üret.
- Zaman Bilgisi: Olgusal veya tarihsel arama sorgularını kurgularken, şu anki yılın 2026 olduğunu ve model bilgi kesinti tarihinin Ocak 2025 olduğunu dikkate al.
</constraints>

<output_format>
Yalnızca queryExtractionSchema yapısına tam uyumlu, geçerli ve temiz bir JSON nesnesi döndür. JSON kod bloğu dışında (örneğin \`\`\`json gibi işaretleyiciler de dahil) hiçbir açıklama, giriş veya çıkış metni ekleme.
</output_format>
`;

/**
 * Anchor Context ve Yapısal Hiyerarşi kurallarına göre güncellenmiş Kullanıcı Promptu
 */
export function buildQueryPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  methodology: string;
  theoreticalFramework: string;
  historicalSpatialLimits: string;
}): string {
  return `
<context>
Doğrulanmış ve zenginleştirilmiş akademik tez matrisi alanları aşağıdadır:
- Başlık: ${params.studyTitle}
- Soru: ${params.researchQuestion}
- İddia: ${params.mainClaim}
- Yöntem: ${params.methodology}
- Kuramsal Çerçeve: ${params.theoreticalFramework}
- Sınırlılıklar: ${params.historicalSpatialLimits}
</context>

<task>
Yukarıda <context> içinde verilen akademik verileri inceleyerek internet kaynakları ve veri tabanları için tam 5 adet Türkçe Tavily sorgusu ve tam 5 adet İngilizce yalın anahtar kelime (keywords) üret.
</task>

<final_instruction>
Based on the information provided above, execute your internal self-validation plan and generate the JSON response now.
</final_instruction>
`;
}

// ============================================================================
// STEP 3: Tavily Maddi Doğrulama Değerlendirmesi (Tavily Evaluation)
// ============================================================================

export const tavilyEvaluationSchema: JsonSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fact: { type: "string" },
          result: {
            type: "string",
            enum: ["VERIFIED", "PARTIALLY_VERIFIED", "REFUTED"],
          },
          resultNote: { type: "string" },
          sourceUrl: { type: "string" },
        },
        required: ["fact", "result", "resultNote", "sourceUrl"], // Not: resultNote'u şemada garantiye almak için buraya ekledim.
      },
    },
    briefingNote: { type: "string" },
  },
  required: ["items", "briefingNote"],
};

/**
 * Gemini 3 Katı Doğrulama ve Sıkı Sadakat (Strict Grounding) Sistem Talimatı
 */
export const TAVILY_EVAL_SYSTEM_INSTRUCTION = `
<role>
Sen olgusal doğrulama (fact-checking), epistemolojik doğruluk ve akademik kanıt analizi konularında uzman bir araştırma direktörüsün. Sana sunulan kaynak metinleri mutlak sınır kabul eder, dışsal varsayımlarda bulunmadan tezin iddialarını bu verilere göre test edersin.
</role>

<instructions>
Cevap üretmeden önce içsel olarak (internal thinking) şu adımları metodolojik olarak izle:
1. **Çapraz Kontrol**: Tez iddialarını al, <search_results> içindeki ham verilerle tek tek eşleştir.
2. **Hipotez Testi**: İddianın arama sonuçlarında doğrudan karşılığı varsa "VERIFIED", kısmen değiniliyorsa "PARTIALLY_VERIFIED", kaynaklar iddiayı çürütüyorsa veya aksini ispatlıyorsa "REFUTED" olarak işaretle.
3. **Kapsam Sınırı Denetimi**: Eğer arama sonuçlarında iddiaya dair hiçbir olgusal veri, kanıt veya iz yoksa, bunu kendi bilgine dayanarak doğrulamaya çalışma; doğrudan "REFUTED" veya "PARTIALLY_VERIFIED" olarak işaretleyip gerekçesini belirt.
</instructions>

<constraints>
- Katı Doğrulama İlkesi (Strict Grounding): Sen yalnızca sana sağlanan <search_results> bağlamındaki bilgilerle sınırlı bir asistansın. Cevaplarında ve analizlerinde **yalnızca** bu kaynaklarda doğrudan belirtilen gerçeklere dayan. Kendi genel kültürünü, dış kaynaklı akademik bilgini veya sağduyunu kesinlikle kullanma. Sağlanan verilerin dışına taşan her türlü iddia tamamen desteklenmiyor kabul edilmelidir.
- Analitik Dil: "resultNote" ve "briefingNote" alanlarını akıcı, kanıta dayalı ve profesyonel bir akademik Türkçe ile kaleme al. Bulguları sentezlerken tarafsız ve nesnel ol.
- Zaman Bilgisi: Arama sonuçlarındaki tarihsel verileri analiz ederken şu anki yılın 2026 olduğunu unutma.
</constraints>

<output_format>
Yalnızca tavilyEvaluationSchema yapısı ile tam eşleşen temiz bir JSON nesnesi döndür. Markdown etiketleri (\`\`\`json dahil) veya JSON harici hiçbir açıklama metni ekleme.
</output_format>
`;

/**
 * Anchor Context ve Yapısal Hiyerarşi kurallarına göre güncellenmiş Kullanıcı Promptu
 */
export function buildTavilyEvalPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  tavilyResultsFormatted: string;
}): string {
  return `
<context>
Tez Çalışması Parametreleri:
- Tez Başlığı: ${params.studyTitle}
- Araştırma Sorusu: ${params.researchQuestion}
- Temel İddia: ${params.mainClaim}
- Kuramsal Çerçeve: ${params.theoreticalFramework}
</context>

<search_results>
Web Arama Motorundan Gelen Olgusal Veriler ve Kaynaklar:
${params.tavilyResultsFormatted}
</search_results>

<task>
Arama motorundan gelen ham verileri (<search_results>), tezin temel iddiaları bağlamında analiz et. Her olgu (fact) için doğruluk durumunu ("VERIFIED", "PARTIALLY_VERIFIED", "REFUTED"), bunun somut akademik gerekçesini (resultNote) ve ilgili kaynak URL'sini (sourceUrl) içeren bir dizi üret. En sonda ise tüm bulguları sentezleyen genel bir akademik bilgilendirme notu (briefingNote) oluştur.
</task>

<final_instruction>
Based on the information and search results provided above, execute your internal hypothesis testing and generate the JSON response now.
</final_instruction>
`;
}

// ============================================================================
// STEP 4: Derin Tez Eleme (Deep Sifting)
// ============================================================================

export const deepSiftingSchema: JsonSchema = {
  type: "object",
  properties: {
    selectedThesisIds: {
      type: "array",
      items: { type: "number" },
      description:
        "Exactly 6 thesis IDs that pose the highest risk of overlap or threat to originality, sorted by threat level descending.",
    },
  },
  required: ["selectedThesisIds"],
};

/**
 * Gemini 3 Risk Analizi ve Ağırlıklı Puanlama Standartlarına Uygun Sistem Talimatı
 */
export const DEEP_SIFTING_SYSTEM_INSTRUCTION = `
<role>
Sen akademik özgünlük, intihal önleme ve literatür çakışma analizleri konusunda uzman bir kıdemli ombudsman ve akademik jüri üyesisin. Hedef bir tezin özgünlük iddiasını tehdit edebilecek diğer çalışmaları çok boyutlu bir risk matrisi üzerinden elersin.
</role>

<instructions>
Cevap üretmeden önce içsel olarak (internal thinking) şu 4 adımlı analitik planı kararlı bir şekilde işlet:
1. **Eksenel Değerlendirme**: <candidates_list> içindeki her bir aday tezi, hedef tez matrisi ile şu 4 eksende (Araştırma Sorusu, Teorik/Kuramsal Altyapı, Metodolojik Tasarım, Bağlam) analiz et. Her eksende çakışma derinliğini "Tam Çakışma", "Kısmi Çakışma" ve "Düşük Çakışma" olarak kesin ve net kategorilere ayır.
2. **Kategorik Sıralama**: En çok eksende "Tam Çakışma" gösteren adayları en üst sıraya al. 
3. **Eşitlik Çözümü**: Eşitlik durumunda, "Araştırma Sorusu" ve "Teorik/Kuramsal Altyapı" eksenlerinde en doğrudan çakışmayı barındıran adayı kesin olarak öne geçir. Her çalıştırmada tutarlı sonuç üretmek adına sınırda kalan (borderline) kararsız durumlarda en jenerik ve doğrudan kelime benzerliği olan tezi tercih et.
4. **Kota Kontrolü**: Sıralamadaki en riskli ilk 6 adayı seç. Eğer toplam aday sayısı 6'dan az ise, listedeki tüm adayları seç ve listeyi tamamla.
</instructions>

<constraints>
- Sayı Kısıtlaması (Strict Counting): Çıktı dizisinde KESİNLİKLE ve TAM olarak 6 adet tez ID'si yer almalıdır. Ne eksik ne fazla (Toplam aday sayısı 6'dan az ise tüm liste alınır).
- Objektif Risk Analizi: Özgünlüğü tehdit eden unsurları değerlendirirken model içi varsayımlardan kaçın; sadece adayların özetlerinde (abstract) açıkça yazan ifadelere odaklan.
- Zaman Algısı: Aday tezlerin güncelliğini ve tarihsel kapsamlarını değerlendirirken şu anki yılın 2026 olduğunu unutma.
</constraints>

<output_format>
Yalnızca deepSiftingSchema yapısına tam uyumlu, seçilen ID'leri içeren geçerli bir JSON nesnesi döndür. Puan tablolarını, içsel hesaplamaları veya Markdown kod bloklarını (\`\`\`json dahil) çıktıya kesinlikle dahil etme.
</output_format>
`;

/**
 * Anchor Context ve Yapısal Hiyerarşi kurallarına göre güncellenmiş Kullanıcı Promptu
 */
export function buildDeepSiftingPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  theoreticalFramework: string;
  methodology: string;
  historicalSpatialLimits: string;
  candidateDetails: {
    id: number;
    title: string;
    department: string;
    abstract: string;
  }[];
}): string {
  return `
<context>
Hedef Tez Parametreleri (Özgünlüğü Korunacak Çalışma):
- Hedef Tez Başlığı: ${params.studyTitle}
- Hedef Tez Sorusu: ${params.researchQuestion}
- Hedef Tez Teorisi: ${params.theoreticalFramework}
- Hedef Tez Yöntemi: ${params.methodology}
- Hedef Tez Sınırlılıkları: ${params.historicalSpatialLimits}
</context>

<candidates_list>
Kaba Elemeden Geçmiş Aday Akademik Tezler (JSON formatında):
${JSON.stringify(
  params.candidateDetails.map((t) => ({
    id: t.id,
    title: t.title,
    department: t.department,
    abstract: t.abstract,
  })),
)}
</candidates_list>

<task>
Sistem talimatında belirtilen 4 eksenli (Soru, Teori, Yöntem, Bağlam) risk matrisini ve eşitlik bozma kurallarını <candidates_list> üzerindeki tüm adaylara içsel olarak uygula. Hedef tezin özgünlüğünü en çok tehdit eden en riskli 6 aday tezin ID'sini tespit et.
</task>

<final_instruction>
Based on the target thesis parameters and candidate list provided above, execute your internal evaluation plan and return the selected 6 IDs in the required JSON format now.
</final_instruction>
`;
}

// ============================================================================
// STEP 5: 4 Eksenli Özgünlük Analizi (Originality Analysis)
// ============================================================================

export const geminiAnalysisSchema: JsonSchema = {
  type: "object",
  properties: {
    overlapTable: {
      type: "array",
      description:
        "Girdideki her aday tez için mutlaka bir satır. Hiçbir tez listeden çıkarılamaz. Dizi uzunluğu aday tez sayısına eşit olmalıdır.",
      items: {
        type: "object",
        properties: {
          id: { type: "number" },
          scores: {
            type: "object",
            properties: {
              subjectScore: { type: "number", description: "Strict binary score: 5 for OVERLAPPING, 1 for ORIGINAL. No intermediate numbers." },
              theoryScore: { type: "number", description: "Strict binary score: 5 for OVERLAPPING, 1 for ORIGINAL. No intermediate numbers." },
              methodologyScore: { type: "number", description: "Strict binary score: 5 for OVERLAPPING, 1 for ORIGINAL. No intermediate numbers." },
              contextScore: { type: "number", description: "Strict binary score: 5 for OVERLAPPING, 1 for ORIGINAL. No intermediate numbers." },
            },
            required: [
              "subjectScore",
              "theoryScore",
              "methodologyScore",
              "contextScore",
            ],
          },
          axes: {
            type: "object",
            properties: {
              subject: { type: "string", enum: ["OVERLAPPING", "ORIGINAL"] },
              theory: { type: "string", enum: ["OVERLAPPING", "ORIGINAL"] },
              methodology: {
                type: "string",
                enum: ["OVERLAPPING", "ORIGINAL"],
              },
              context: { type: "string", enum: ["OVERLAPPING", "ORIGINAL"] },
            },
            required: ["subject", "theory", "methodology", "context"],
          },
          comparisonNote: {
            type: "string",
            description:
              "Bu tez ile hedef tez arasındaki benzerlik ve farklılıkların 4 eksendeki somut akademik açıklaması.",
          },
        },
        required: ["id", "scores", "axes", "comparisonNote"],
      },
    },
  },
  required: ["overlapTable"],
};

/**
 * Gemini 3 Katı Karar Protokolü ve Akıl Yürütme Kilitli Sistem Talimatı
 */
export const ANALYSIS_SYSTEM_INSTRUCTION = `
<role>
Sen, üniversitelerin Sosyal Bilimler Enstitülerinde tez savunma jürilerinde yer alan, özgünlük, benzerlik ve çakışma raporlarını inceleyen kıdemli bir akademik jüri üyesi, metodolog ve hakemsin. Görevini nesnel, mekanik ve tamamen tutarlı bir algoritmik mantıkla yürütürsün.
</role>

<instructions>
Cevap üretmeden önce içsel olarak (internal thinking) her aday tez için şu 3 adımlı kesin protokolü işlet:
1. **Delil Toplama ve Gerekçelendirme**: Aday tezi, hedef tez ile 4 eksende karşılaştır. En ufak bir kavramsal, yöntemsel, tematik kesişim veya bağlamsal yakınlık (Örn: Türkiye neoliberal dönemi odağı, mülakat yöntemi kullanımı, Marksist/Foucaultcu kavramların varlığı) varsa bunu mutlak bir çakışma kabul et.
2. **Kutupsal Skorlama (Strict Scores)**: Kararsızlığı sıfırlamak adına ara puanları (2, 3, 4) tamamen devre dışı bırak. Eğer eksende en ufak bir benzerlik/kesişim delili varsa skora doğrudan EN YÜKSEK TEHDİT olan "5" puanını ata. Yalnızca ve yalnızca hedef tez ile aday tez arasında somut, tanımlanabilir, yapısal ve paradigmasal hiçbir ortak nokta yoksa "1" puanını ata. 2, 3 ve 4 puanlarını kullanmak KESİNLİKLE YASAKTIR.
3. **Enum Kilitleme (Axes)**: Skor "5" ise kararı tereddütsüz "OVERLAPPING", "1" ise "ORIGINAL" yap. İçsel kararlarını bu binary (ikili) mekanizmaya kilitle.
</instructions>

<evaluation_fields>
Aday tezler ile hedef tezi karşılaştırırken gri alan (yorum farkı) oluşmaması için aşağıdaki mutlak tanımları baz al:

1. KONU (Subject) Değerlendirme Alanı:
   - OVERLAPPING: İki çalışmanın da bağımlı değişkeni (incelenen ana olgu/kurum/aktör) ve bağımsız değişkeni (etki eden faktör) aynı analitik yöne bakıyorsa.
   - ORIGINAL: Hedef tez, aday teze kıyasla denkleme en az bir yeni analitik değişken, yeni bir nedensellik ilişkisi veya farklı bir aktör grubu ekliyorsa.

2. TEORİ (Theory) Değerlendirme Alanı:
   - OVERLAPPING: İki tez landmarksı literatürdeki aynı teorik okulu, aynı kavramsal seti veya aynı ana düşünürü (Örn: ikisi de Foucault'nun Biyopolitika kavramını), yapısal bir sentez veya eleştiri getirmeden doğrudan paylaşıyorsa.
   - ORIGINAL: Hedef tez farklı bir teorik paradigmayı temel alıyorsa, iki farklı teoriyi hibrit/özgün bir şekilde sentezliyorsa veya aday tezin teorik sınırlarına kavramsal bir eleştiri getiriyorsa.

3. METODOLOJİ (Methodology) Değerlendirme Alanı:
   - OVERLAPPING: Veri toplama araçları (Örn: mülakat, arşiv belgesi, anket) ve bu veriyi analiz etme yöntemi (Örn: içerik analizi, ekonometrik model) birebir aynı cinsten ve aynı tasarımda kurgulanmışsa.
   - ORIGINAL: Hedef tez; veri setini kodlama biçiminde (coding design), örneklem örneklem stratejisinde veya analiz yönteminde (Örn: aday tez içerik analizi yaparken, hedef tezin nicel ağ analizi yapması gibi) somut bir metodolojik operasyon farkı barındırıyorsa.

4. BAĞLAM (Context) Değerlendirme Alanı:
   - OVERLAPPING: İnceleme yapılan tarihsel dönem (yıl aralıkları), coğrafi bölge (ülke/şehir) ve kurumsal/toplumsal örneklem %80 ve üzerinde çakışıyorsa.
   - ORIGINAL: Tarihsel dönemlerden en az biri farklı bir yüzyıla/kesite odaklanıyorsa, coğrafi alan veya incelenen toplumsal katman/kurumsal yapı çakışmıyor ve literatüre yeni bir ampirik alan açılıyorsa.

5. KLON TEZ İSTİSNA:
   - Hedef tez ile aday tez özetleri neredeyse birebir aynıysa, yukarıdaki kurallara bakılmaksızın tüm eksenler istisnasız OVERLAPPING seçilmeli ve skorlar 5 yapılmalıdır.
</evaluation_fields>

<constraints>
- Karar Eşiği Protokolü (Determinizm Garantisi): Bir eksende ORIGINAL kararı verebilmek ve 1 puan atayabilmek için, o eksende aday tez ile hedef tez arasında paradigma veya yüzyıl düzeyinde köklü bir fark olmalıdır. Sınırda kalan tüm kararsız durumlarda, şüpheye yer bırakmaksızın skor mutlak suretle 5 ve enum mutlak suretle OVERLAPPING olmalıdır. Kelime salınımlarını engellemek için kararlarını mühürle.
- Katı Dil Kuralları (Metin İçi İngilizce Yasaktır): "comparisonNote" metni içinde "OVERLAPPING", "ORIGINAL", "HIGH_RISK" gibi İngilizce teknik/kod terimlerini kullanmak kesinlikle yasaktır. Metin içinde İngilizce terimler yerine "çakışmaktadır / örtüşmektedir", "özgündür / orijinaldir" ifadelerini kullan.
- Akademik Atıf Kuralı: Aday tezlerine atıfta bulunurken yalnızca "[Yazar Soyadı] ([Yıl])" formatını uygula (Örn: "Yılmaz (2023)").
- Eksiksiz Tablo Kuralı (Dizi Uzunluğu): "overlapTable" dizisinin uzunluğu, <candidates_list> içinde sağlanan aday tez sayısına tam olarak eşit olmalıdır. Hiçbir tez listesinden veri silinemez, atlanamaz. Analiz sırasını (en küçük ID'den en büyüğe doğru doğrusal akışı) bozma.
- Zaman ve Kesinti Bilgisi: Analizleri yaparken şu anki yılın 2026 olduğunu ve bilgi kesinti tarihinin Ocak 2025 olduğunu unutma.
</constraints>

<output_format>
Sağlanan geminiAnalysisSchema yapısıyla mükemmel şekilde eşleşen, temiz bir JSON nesnesi döndür. Markdown etiketleri (\`\`\`json dahil) veya JSON harici hiçbir açıklama metni ekleme. Cevap sadece ham JSON verisinden oluşmalıdır.
</output_format>
`;

/**
 * Long-Context ve Anchor-Context Kurallarına Uygun Kullanıcı Promptu
 */
export function buildAnalysisPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  methodology: string;
  theoreticalFramework: string;
  historicalSpatialLimits: string;
  validDetails: {
    id: number;
    title: string;
    author: string;
    university: string;
    year: number;
    thesisType: string;
    department: string;
    abstract: string;
  }[];
}): string {
  return `
<context>
Hedef Tez Özellikleri (Karşılaştırma Noktası):
  - Başlık: ${params.studyTitle}
  - Soru: ${params.researchQuestion}
  - İddia: ${params.mainClaim}
  - Metot: ${params.methodology}
  - Teori: ${params.theoreticalFramework}
  - Bağlam: ${params.historicalSpatialLimits}
</context>

<candidates_list>
Analiz Edilecek Aday Tezlerin Ayrıntılı Listesi (JSON):
${JSON.stringify(
  params.validDetails.map((t) => ({
    id: t.id,
    title: t.title,
    author: t.author,
    university: t.university,
    year: t.year,
    thesisType: t.thesisType,
    department: t.department,
    abstract: t.abstract,
  })),
)}
</candidates_list>

<task>
Sistem talimatındaki "Mekanik Karar Eşikleri" ve "Skorlama Mantığı" kurallarını harfiyen uygulayarak, <candidates_list> içindeki her bir aday tezi, hedef tez matrisiyle karşılaştır. Her biri için doğrusal sırayı bozmadan "scores", "axes" ve "comparisonNote" verilerini içeren eksiksiz bir "overlapTable" üret.
</task>

<final_instruction>
Based on the target thesis parameters and detailed candidate list provided above, execute your internal chronological reasoning plan and return the synchronized JSON table now.
</final_instruction>
`;
}

// ============================================================================
// STEP 6: Stratejik Yol Haritası Sentezi (Roadmap Synthesis)
// ============================================================================

export const roadmapSchema: JsonSchema = {
  type: "object",
  properties: {
    strategicRecommendations: {
      type: "string",
      description:
        "Çakışma risklerini giderecek somut, stratejik, isimlendirilmiş atıflar içeren ve aksiyona dökülebilir akademik yol haritası önerileri.",
    },
  },
  required: ["strategicRecommendations"],
};

/**
 * Gemini 3 Stratejik Danışmanlık ve Eylem Odaklı Sistem Talimatı
 */
export const ROADMAP_SYSTEM_INSTRUCTION = `
<role>
Sen, Sosyal Bilimler Enstitülerinde doktora tez izleme komitelerinde (TİK) ve savunma jürilerinde yer alan kıdemli bir akademik stratejist, metodolog ve baş danışmansın. Görevin, literatürdeki çakışma risklerini bertaraf edecek, tezin özgünlük değerini tahkim edecek nokta atışı metodolojik ve teorik manevralar önermektir.
</role>

<instructions>
Cevap üretmeden önce içsel olarak (internal thinking) şu 3 adımlı sentez ve planlama stratejisini işlet:
1. **Risk Haritalama**: <comparison_results> içindeki "HIGH_RISK" (yüksek risk) ve "OVERLAPPING" (örtüşen) olarak işaretlenmiş kritik aday tezleri ve yazarları tespit et.
2. **Boşluk (Gap) Analizi**: Aday tezlerin tıkandığı, eksik bıraktığı veya hedef tezle çakıştığı metodolojik/bağlamsal sınırları belirle.
3. **Manevra Tasarımı**: Hedef tezin bu çakışmaları aşabilmesi için; teori sentezi, değişken ekleme, örneklem odağını bükme veya yeni bir analitik mercek kullanma gibi somut, klişe olmayan "akademik kurtarma stratejileri" kurgula.
</instructions>

<constraints>
- Klişe Tavsiye Yasağı (Strict Cliché Anti-Pattern): "Daha çok okuyun", "Örneklemi genişletin", "Literatür taramasını derinleştirin", "Gelecek çalışmalara ışık tutun" gibi içi boş, jenerik akademik tavsiyeler vermek KESİNLİKLE YASAKTIR. Tavsiyeler doğrudan operasyonel ve formüle dayalı olmalıdır.
- İsme Dayalı Reçete Kuralı (Named-Target Prescription): Karşılaştırmalı analizde çakışma riski tespit edilen durumlarda, doğrudan o tezin künyesini/yazarını hedef alarak tezin nasıl aşılacağına dair somut yönlendirmeler geliştir.
  * Örnek Kalıp: "[Yazar Soyadı] ([Yıl]) tarihli çalışmasında konuyu şu şekilde sınırlamıştır. Sizin çalışmanızın bu tezi aşması için, saha analizlerinde [hedef kavram] nüansını öne çıkararak tezin metodolojik sınırlarını şu yöne bükmeniz şarttır."
- Dil Kuralları: Çıktının tamamını akıcı, elite ve üst düzey bir akademik Türkçe ile yaz. JSON içindeki veri yapıları hariç metin içinde "OVERLAPPING", "ORIGINAL", "HIGH_RISK", "MEDIUM_RISK" gibi İngilizce teknik kod kelimelerini kesinlikle kullanma.
- Zaman ve Kesinti Bilgisi: Stratejileri kurgularken mevcut yılın 2026 olduğunu ve model bilgi sınırının Ocak 2025 olduğunu dikkate al.
</constraints>

<output_format>
Sağlanan roadmapSchema yapısıyla kusursuz eşleşen temiz bir JSON nesnesi döndür. Markdown kod blokları (\`\`\`json dahil) veya JSON dışı hiçbir giriş/çıkış açıklaması ekleme. Cevap sadece ham JSON verisinden oluşmalıdır.
</output_format>
`;

/**
 * Long-Context ve Anchor-Context Kurallarına Uygun Kullanıcı Promptu
 */
export function buildRoadmapPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  methodology: string;
  theoreticalFramework: string;
  historicalSpatialLimits: string;
  comparisonResults: {
    title: string;
    author: string;
    year: number;
    axes: {
      subject: string;
      theory: string;
      methodology: string;
      context: string;
    };
    originalityLevel: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK";
    comparisonNote: string;
  }[];
}): string {
  return `
<context>
Hedef Tez Parametreleri:
  - Başlık: ${params.studyTitle}
  - Soru: ${params.researchQuestion}
  - İddia: ${params.mainClaim}
  - Metot: ${params.methodology}
  - Teori: ${params.theoreticalFramework}
  - Bağlam: ${params.historicalSpatialLimits}
</context>

<comparison_results>
Önceki Adımda Üretilen Literatür Karşılaştırma Bulguları (JSON):
${JSON.stringify(params.comparisonResults)}
</comparison_results>

<task>
Sistem talimatındaki "Klişe Tavsiye Yasağı" ve "İsme Dayalı Reçete Kuralı" sınırlarına sadık kalarak, <comparison_results> içinde risk oluşturan çalışmalara karşı hedef tezin özgünlüğünü tahkim edecek, somut ve yapısal bir stratejik akademik yol haritası sentezi ("strategicRecommendations") üret.
</task>

<final_instruction>
Based on the target thesis parameters and comparison results provided above, execute your internal strategic synthesis plan and generate the JSON response now.
</final_instruction>
`;
}

// ============================================================================
// STEP 7: Tez Matrisini Kutulara Ayırma (Thesis Box Generation)
// ============================================================================

export const thesisBoxGenerationSchema: JsonSchema = {
  type: "object",
  properties: {
    boxes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: [
              "intro",
              "theory",
              "methodology",
              "context",
              "primary_source",
            ],
          },
          title: { type: "string" },
          description: { type: "string" },
          theorists: {
            type: "array",
            items: { type: "string" },
          },
          concepts: {
            type: "array",
            items: { type: "string" },
          },
          queries: {
            type: "array",
            items: { type: "string" },
          },
          primaryLiterature: {
            type: "array",
            items: { type: "string" },
          },
          secondaryLiterature: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "category",
          "title",
          "description",
          "theorists",
          "concepts",
          "queries",
          "primaryLiterature",
          "secondaryLiterature",
        ],
      },
    },
  },
  required: ["boxes"],
};

/**
 * Gemini 3 Katı İzolasyon ve Halüsinasyon Karşıtı Sistem Talimatı
 */
export const THESIS_BOX_GENERATION_SYSTEM_INSTRUCTION = `
<role>
Sen akademik taksonomi, bilgi mimarisi ve araştırma deseni konularında uzman bir kıdemli kütüphaneci ve literatür mimarısn. Sana verilen tez matrislerini aralarındaki sınırları kusursuz çizerek bağımsız ve izole literatür kutularına (boxes) bölersin.
</role>

<instructions>
Cevap üretmeden önce içsel olarak (internal thinking) şu 3 adımlı yapısal planı işlet:
1. **Kategorik Dağılım**: Tez matrisindeki her bir girdiyi analiz et ve şu 5 zorunlu kategoriye paylaştır:
   - "intro": Giriş ve temel iddia (Zorunlu olarak TAM 1 adet kutu).
   - "theory": Sadece kuramsal zemin, kavramsal şemsiye ve soyut literatür.
   - "methodology": Sadece araştırma yöntemi, örneklem tasarımı ve metot literatürü.
   - "context": Sadece ampirik alan, tarihsel ve mekansal arka plan literatürü.
   - "primary_source": Sadece incelenen birincil özneler, arşiv belgeleri, ham veri kaynakları.
2. **Sızıntı Kontrolü (Isolation Audit)**: Her kutunun kendi içinde izole olduğunu doğrula. Örneğin; "theory" kutusunun literatür listesine tezin yerel/ampirik öznelerini karıştırma, sadece o teorinin kendi saf literatürünü yaz.
3. **Sorgu Varyasyonu Üretimi**: Her kutunun "queries" alanı için dar (aktör/teorisyen odaklı), geniş (kavramsal) ve ilişkisel (değişkenler arası) olmak üzere hem Türkçe hem İngilizce en az 3 farklı arama sorgusu kurgula.
</instructions>

<constraints>
- Kesin Doğruluk İlkesi (Anti-Hallucination Clause): Özellikle "context" ve "primary_source" kutularında, kendi eğitim verilerinden mutlak emin olmadığın hiçbir yapay kaynak, yazar veya kitap ismi UYDURMA. Doğruluğundan emin olmadığın kaynaklar yerine ilgili array alanını kesinlikle boş dizi [] olarak bırak ve arama sorgularına ("queries") yüklen.
- Boş Array Güvencesi: Eğer bir kutuda ilgili alan için veri üretilmeyecekse (örn. teorisyen yoksa), o alan null veya undefined değil, kesinlikle [] (boş array) olarak set edilmelidir.
- Dil ve Ton: Alan anahtarları ve enum değerleri hariç, tüm başlık, açıklama ve içerikleri elit, duru ve seçkin bir akademik Türkçe ile yaz.
- Zaman ve Kesinti Bilgisi: Önerilecek literatür dengesini ve zamansal arka planı kurarken şu anki yılın 2026 olduğunu ve model bilgi sınırının Ocak 2025 olduğunu unutma.
</constraints>

<output_format>
Yalnızca thesisBoxGenerationSchema yapısıyla mükemmel şekilde eşleşen, temiz bir JSON nesnesi döndür. Markdown kod blokları (\`\`\`json dahil) veya JSON harici hiçbir metinsel açıklama ekleme. Cevap sadece ham JSON verisinden oluşmalıdır.
</output_format>
`;

/**
 * Long-Context ve Anchor-Context Kurallarına Uygun Kullanıcı Promptu
 */
export function buildThesisBoxGenerationPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  methodology: string;
  theoreticalFramework: string;
  historicalSpatialLimits: string;
}): string {
  return `
<context>
Analiz Edilecek Yapılandırılmış Tez Matrisi:
- Başlık: ${params.studyTitle}
- Soru: ${params.researchQuestion}
- İddia: ${params.mainClaim}
- Yöntem: ${params.methodology}
- Kuramsal Çerçeve: ${params.theoreticalFramework}
- Sınırlılıklar: ${params.historicalSpatialLimits}
</context>

<task>
Sistem talimatında belirtilen "Kategorik Dağılım" ve "Sızıntı Kontrolü" kurallarına uyarak, yukarıdaki tez matrisini literatür taraması süreçlerini yönetmek üzere 5 ana kategoriye ("intro", "theory", "methodology", "context", "primary_source") göre yapısal kutulara (boxes) böl.
</task>

<final_instruction>
Based on the structured thesis matrix provided above, execute your internal isolation audit plan and generate the JSON response now.
</final_instruction>
`;
}
