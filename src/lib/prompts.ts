import type { JsonSchema } from "./gemini";

// ============================================================================
// JSON Schema Constants
// ============================================================================

/**
 * Tez matrisi akademik zenginleştirme adımında kullanılan JSON şeması.
 * Gemini'den 6 akademik alan beklenir: academicStudyTitle,
 * literatureResearchQuestion, refinedThesisClaim,
 * conceptualTheoreticalInfrastructure, academicMethodologyDesign,
 * historicalSpatialLimits.
 */
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
 * Sorgu çıkarma adımında kullanılan JSON şeması.
 * Gemini'den tavilyQueries (Türkçe olgusal sorgular) ve
 * tezaraQueries (İngilizce akademik arama sorguları) döndürmesi beklenir.
 */
export const queryExtractionSchema: JsonSchema = {
  type: "object",
  properties: {
    tavilyQueries: {
      type: "array",
      items: { type: "string" },
      description: "Exactly 5 historical or factual queries in Turkish.",
    },
    tezaraQueries: {
      type: "array",
      items: { type: "string" },
      description:
        "An array of EXACTLY 5 English search queries. EACH query MUST consist of EXACTLY and ONLY 2 words (e.g. ['neoliberal debt', 'indebtedness Turkey']) to perform a strict 2-keyword AND search. Single-word queries or queries with 3 or more words are STRICTLY FORBIDDEN.",
    },
  },
  required: ["tavilyQueries", "tezaraQueries"],
};

/**
 * Tavily maddi doğrulama değerlendirmesi için JSON şeması.
 * Her biri fact, result ve sourceUrl alanlarına sahip değerlendirilmiş
 * olgular dizisi ve bir özet bilgilendirme notu (briefingNote) döndürür.
 */
export const tavilyEvaluationSchema: JsonSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fact: { type: "string" },
          result: { type: "string" },
          sourceUrl: { type: "string" },
        },
        required: ["fact", "result", "sourceUrl"],
      },
    },
    briefingNote: { type: "string" },
  },
  required: ["items", "briefingNote"],
};

/**
 * 4 eksenli özgünlük analizi için JSON şeması.
 * Her tez için konu, teori, metodoloji ve bağlam eksenleri
 * OVERLAPPING | PARTIAL | ORIGINAL olarak değerlendirilir,
 * ayrıca stratejik tavsiyeler (strategicRecommendations) döndürülür.
 */
export const geminiAnalysisSchema: JsonSchema = {
  type: "object",
  properties: {
    overlapTable: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "number" },
          axes: {
            type: "object",
            properties: {
              subject: {
                type: "string",
                enum: ["OVERLAPPING", "PARTIAL", "ORIGINAL"],
              },
              theory: {
                type: "string",
                enum: ["OVERLAPPING", "PARTIAL", "ORIGINAL"],
              },
              methodology: {
                type: "string",
                enum: ["OVERLAPPING", "PARTIAL", "ORIGINAL"],
              },
              context: {
                type: "string",
                enum: ["OVERLAPPING", "PARTIAL", "ORIGINAL"],
              },
            },
            required: ["subject", "theory", "methodology", "context"],
          },
        },
        required: ["id", "axes"],
      },
    },
    strategicRecommendations: { type: "string" },
  },
  required: ["overlapTable", "strategicRecommendations"],
};

/**
 * Kaba tez eleme (sifting) adımı için JSON şeması.
 * Aday listeden seçilecek ilgili tez ID'lerini döndürür.
 */
export const siftingSchema: JsonSchema = {
  type: "object",
  properties: {
    relevantThesisIds: {
      type: "array",
      items: { type: "number" },
    },
  },
  required: ["relevantThesisIds"],
};

// ============================================================================
// System Instruction Constants
// ============================================================================

/**
 * Tez matrisi akademik zenginleştirme için sistem talimatı.
 * Gemini'ye kıdemli bir akademik danışman rolü verir ve öğrencinin
 * gündelik dil girdisini olgun akademik/teorik düzyazıya dönüştürmesini ister.
 */
export const MATRIX_ENHANCEMENT_SYSTEM_INSTRUCTION = `
<role>
Kıdemli bir akademik danışman ve sosyal bilimler/beşeri bilimler alanında parlak bir teorisyensiniz.
Tek göreviniz, bir lisansüstü öğrencisinin gündelik dille girdiği ham ifadeleri tamamen olgunlaşmış akademik, teorik ve bilimsel bir dile tercüme etmektir.
</role>

<constraints>
- Ham girdiyi asla harfi harfine tekrarlamayın veya sadece başka sözcüklerle açıklamayın/özetlemeyin.
- Her zaman uygun teorik mercekleri (Foucault, Bourdieu, Butler, Latour, Deleuze, Haraway vb.) ve akademik kavramları kullanın.
- Dili, yayınlanabilir akademik düzyazı seviyesine yükseltin.
- Her çıktı alanı, iyi yapılandırılmış bir tez önerisinden veya akademik makaleden alınmış bir paragraf gibi okunmalıdır.
- Yalnızca sağlanan şema ile eşleşen geçerli bir JSON ile yanıt verin.
- Çıktıların tamamını akıcı, elit bir akademik Türkçe ile yazın.
</constraints>
`;

/**
 * Sorgu çıkarma adımı için sistem talimatı.
 * Gemini'ye tez matrisinden Tavily için Türkçe olgusal sorgular
 * ve Tezara için İngilizce akademik sorgular üretmesini söyler.
 */
export const QUERY_EXTRACTION_SYSTEM_INSTRUCTION = `
<role>
Uzman bir akademik danışmansınız. Göreviniz, kullanıcının tez matrisinden arama sorguları çıkarmaktır.
</role>

<constraints>
1. Tavily arama motoru için Türkçe dilinde KESİNLİKLE ve SADECE 5 adet olgusal sorgu üretmelisiniz. Bu sorgular, tez matrisinde adı geçen tarihsel olguları, ittifakları, kavramları veya anlaşmaları doğrulamayı amaçlamalıdır. "tavilyQueries" alanını kesinlikle boş bırakmayın.
2. Tezara (diller arası tez araması) için KESİNLİKLE ve SADECE 5 adet İngilizce arama sorgusu üretmelisiniz. "tezaraQueries" alanını kesinlikle boş bırakmayın.
   - Her bir sorgu KESİNLİKLE ve SADECE 2 kelimeden (2-Keyword, Strict AND mantığı) oluşmalıdır (örn. ["neoliberal debt", "indebtedness Turkey"]).
   - 3 veya daha fazla kelime içeren ya da tek kelimelik sorgu üretmek KESİNLİKLE YASAKTIR.
   - Sorgular tırnak işareti, ters tırnak veya özel karakter içermemelidir.
   - Sadece soyut felsefi şemsiye kelimeler üretmek yerine; yazarların özet metinlerine yazabileceği kuramcı sıfatlarını (örn. "Foucauldian", "Bourdieusian"), ampirik saha ögelerini ve somut araştırma nesnelerini ikişerli kombinasyonlar halinde üretmelidir.
3. Yalnızca şemayla eşleşen geçerli, temiz bir JSON nesnesiyle yanıt verin. JSON'ı \`\`\`json ... \`\`\` gibi markdown kod bloklarına sarmayın, herhangi bir markdown, ön metin, giriş, son metin, açıklama veya not yazmayın.
</constraints>
`;

/**
 * Tavily maddi doğrulama değerlendirmesi için sistem talimatı.
 * Gemini'ye web arama sonuçlarını tez iddialarına göre analiz ettirir,
 * doğrulanmış olgular listesi ve bir bilgilendirme notu üretmesini ister.
 */
export const TAVILY_EVAL_SYSTEM_INSTRUCTION = `
<role>
Olgusal doğrulama uzmanı ve akademik danışmansınız.
Kullanıcının tez iddialarına karşı her bir sorgunun internet arama sonuçlarını analiz edin.
</role>

<constraints>
- Değerlendirilen olguların bir listesini oluşturun; bunların doğrulanıp doğrulanmadığını ("Doğrulandı", "Kısmen Doğrulandı" veya "Doğrulanamadı/Dikkat") belirtin. Türkçe olarak nedenini kısaca açıklayın.
- Her olgu için en iyi kaynak URL'sini seçin.
- Ayrıca bulguları ve tarihsel/olgusal bağlamı özetleyen Türkçe, analitik ve profesyonel bir bilgilendirme notu (briefing note) oluşturun.
- Yalnızca şemayla eşleşen geçerli bir JSON ile yanıt verin.
</constraints>
`;

/**
 * Kaba tez eleme (sifting) için sistem talimatı.
 * Gemini'ye aday tez listesinden hedef tez matrisiyle en tematik
 * ilişkili 5-7 tezi seçmesini söyler.
 */
export const SIFTING_SYSTEM_INSTRUCTION = `
<role>
Akademik bir araştırmacısınız. Size akademik tezlerin bir listesi ve hedef tez matrisi verilmektedir.
Göreviniz, hedef tez ile tematik, konu, metodolojik veya bağlamsal yakınlığı olan veya ilgili olan en iyi 5 ila 7 tezi seçmektir.
</role>

<constraints>
- Bu eleme aşamasında son derece esnek ve temkinli olun. Tematik benzerliği veya bölgesel/dönemsel çakışmaları olan tezleri hariç tutmayın.
- En ilgili veya en yakın olan en fazla 7 tezi seçin.
- Yalnızca şemayla eşleşen geçerli bir JSON ile yanıt verin.
</constraints>
`;

/**
 * Nihai 4 eksenli özgünlük analizi için sistem talimatı.
 * Gemini'ye hedef tez matrisini her bir literatür teziyle
 * Konu, Teori, Metodoloji ve Bağlam eksenlerinde karşılaştırmasını söyler.
 */
export const ANALYSIS_SYSTEM_INSTRUCTION = `
<role>
Kıdemli bir akademik kurul değerlendiricisisiniz. Göreviniz, hedef tez matrisini literatürdeki tezlerin bir listesiyle 4 eksende karşılaştırmaktır:
1. Konu (Subject)
2. Teori (Theory)
3. Metodoloji (Methodology)
4. Bağlam (Mekânsal/Tarihsel Sınırlar - Context)

Her literatür tezi için bu 4 ekseni değerlendirin ve bir karşılaştırma değeri atayın: "OVERLAPPING", "PARTIAL" veya "ORIGINAL".
Ayrıca, öğrencinin çalışmasının özgünlüğünü koruması veya geliştirmesi ve belirlenen çakışma risklerini aşması için stratejik akademik öneriler sunmalısınız. Tüm çıktılar Türkçe olmalıdır.
</role>

<constraints>
- "Daha çok okuyun", "Örneklemi genişletin", "Literatür taramasını derinleştirin" gibi klişe, içi boş akademik tavsiyeler vermek KESİNLİKLE YASAKTIR.
- Risk veya çakışma tespit ettiğiniz durumlarda doğrudan o tezin künyesini/yazarını hedef alarak saldırgan bir akademik savunma/konumlandırma tavsiyesi geliştirin.
- Örnek Format: "[Yazar Adı] ([Yıl]) tarihli çalışmasında konuyu şu şekilde sınırlamıştır. Sizin çalışmanızın bu tezi aşması için, saha analizlerinde [hedef kavram] nüansını öne çıkararak tezin metodolojik sınırlarını şu yöne bükmeniz şarttır."
- Yalnızca şemayla eşleşen geçerli bir JSON ile yanıt verin.
</constraints>
`;

// ============================================================================
// Prompt Builder Functions
// ============================================================================

/**
 * Tez matrisi akademik zenginleştirme için kullanıcı promptunu oluşturur.
 * Ham matris alanlarını XML tabanlı görev şablonuna yerleştirir ve
 * Gemini'den 6 akademik alan üretmesini ister.
 *
 * @param params - Ham tez matrisi girdi alanları
 * @returns Gemini'ye gönderilmeye hazır prompt metni
 */
export function buildMatrixEnhancementPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  methodology: string;
  theoreticalFramework: string;
  historicalSpatialLimits: string;
}): string {
  return `<context>
Aşağıda, kullanıcının 1. adımda gündelik dille girdiği ham tez matrisi verileri yer almaktadır. Bu verileri akademik/teorik bir dile tercüme edin.

<studyTitle>
${params.studyTitle}
</studyTitle>

<researchQuestion>
${params.researchQuestion}
</researchQuestion>

<mainClaim>
${params.mainClaim}
</mainClaim>

<methodology>
${params.methodology}
</methodology>

<theoreticalFramework>
${params.theoreticalFramework}
</theoreticalFramework>

<historicalSpatialLimits>
${params.historicalSpatialLimits}
</historicalSpatialLimits>
</context>

<task>
Yukarıdaki ham verileri kullanarak aşağıdaki 6 alanı doldurun:

1. academicStudyTitle: Ham çalışma başlığını, alana uygun kavramsal terimlerle bilimsel bir tez başlığına dönüştürün.
2. literatureResearchQuestion: Araştırma sorusunu, teorik değişkenleri ve literatür bağlamını görünür kılacak şekilde akademik formda yeniden ifade edin.
3. refinedThesisClaim: Temel iddiayı, bilimsel bir hipotez/sav haline getirin; karşıt argümanlarla diyaloğa girebilecek düzeyde teorik pozisyon alın.
4. conceptualTheoreticalInfrastructure: Ham kuramsal çerçeve ve sınır bilgilerini kullanarak, çalışmanın hangi teorik merceklerle (Foucault, Bourdieu, Butler vb.) okunacağını ve hangi literatürle diyaloga gireceğini akademik dille açıklayın.
5. academicMethodologyDesign: Ham metodoloji tanımını, bilimsel araştırma deseni (etnografi, söylem analizi, tarihsel analiz, vb.) ve veri toplama/analiz yöntemleriyle zenginleştirilmiş akademik bir metodoloji bölümüne dönüştürün.
6. historicalSpatialLimits: Ham tarihsel/mekânsal sınır tanımını, çalışmanın kapsamını, bağlamını ve sınırlılıklarını bilimsel bir dille ifade eden akademik bir alana dönüştürün. Zaman aralığını, coğrafi/mekânsal sınırları ve bu sınırların araştırma deseni açısından anlamını teorik olarak gerekçelendirin.
</task>`;
}

/**
 * Tavily/Tezara sorgu çıkarma için kullanıcı promptunu oluşturur.
 * Matris alanlarını yerleştirir ve Gemini'den Türkçe olgusal sorgular
 * ile İngilizce akademik arama sorguları üretmesini ister.
 *
 * @param params - Tez matrisi alanları
 * @returns Gemini'ye gönderilmeye hazır prompt metni
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
Aşağıda kullanıcının doğrulanmış tez matrisi yer almaktadır:
<studyTitle>${params.studyTitle}</studyTitle>
<researchQuestion>${params.researchQuestion}</researchQuestion>
<mainClaim>${params.mainClaim}</mainClaim>
<methodology>${params.methodology}</methodology>
<theoreticalFramework>${params.theoreticalFramework}</theoreticalFramework>
<historicalSpatialLimits>${params.historicalSpatialLimits}</historicalSpatialLimits>

Olgusal Tavily sorgularını ve diller arası İngilizce Tezara sorgularını çıkarın.
KRİTİK: JSON nesnesinde "tavilyQueries" (Türkçe) için KESİNLİKLE ve SADECE 5 adet sorgu ve "tezaraQueries" (İngilizce) için KESİNLİKLE ve SADECE 5 adet sorgu üretmelisiniz.
Şemayla eşleşen HAM, temiz bir JSON yanıtı döndürün. Markdown kod biçimlendirmesi, ters tırnak veya herhangi bir açıklama eklemeyin.
`;
}

/**
 * Tavily maddi doğrulama değerlendirmesi için kullanıcı promptunu oluşturur.
 * Tez matrisi bağlamını ve biçimlendirilmiş web arama sonuçlarını yerleştirir,
 * Gemini'den olgusal iddiaları doğrulamasını ve bir bilgilendirme notu
 * hazırlamasını ister.
 *
 * @param params - Matris alanları ve biçimlendirilmiş arama sonuçları
 * @returns Gemini'ye gönderilmeye hazır prompt metni
 */
export function buildTavilyEvalPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  tavilyResultsFormatted: string;
}): string {
  return `
Kullanıcının tez matrisi:
- Başlık: ${params.studyTitle}
- Araştırma Sorusu: ${params.researchQuestion}
- Temel İddia: ${params.mainClaim}
- Kuramsal Çerçeve: ${params.theoreticalFramework}

Arama sorgularına ait internet arama sonuçları aşağıdadır:
${params.tavilyResultsFormatted}

Lütfen bu sonuçları değerlendirerek her bir sorgunun doğruluk durumunu tespit edin ve genel bir akademik briefing notu hazırlayın.
`;
}

/**
 * Kaba tez eleme (sifting) için kullanıcı promptunu oluşturur.
 * Matris bağlamını ve aday tez listesini yerleştirir,
 * Gemini'den en alakalı 5-7 tez ID'sini seçmesini ister.
 *
 * @param params - Matris alanları ve tekilleştirilmiş tez listesi
 * @returns Gemini'ye gönderilmeye hazır prompt metni
 */
export function buildSiftingPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  theoreticalFramework: string;
  methodology: string;
  historicalSpatialLimits: string;
  uniqueTheses: {
    id: number;
    title: string;
    author: string;
    university: string;
    year: number;
    department: string;
  }[];
}): string {
  return `
Hedef Tez Matrisi:
- Başlık: ${params.studyTitle}
- Konu/Araştırma Sorusu: ${params.researchQuestion}
- Teori: ${params.theoreticalFramework}
- Metodoloji: ${params.methodology}
- Bağlam: ${params.historicalSpatialLimits}

Aramadan elde edilen aday tezlerin listesi:
${JSON.stringify(
  params.uniqueTheses.map((t) => ({
    id: t.id,
    title: t.title,
    author: t.author,
    university: t.university,
    year: t.year,
    department: t.department,
  })),
)}

Lütfen en yakından ilişkili olan en iyi 5 ila 7 tez kimliğini (ID) seçin.
`;
}

/**
 * Nihai 4 eksenli özgünlük analizi için kullanıcı promptunu oluşturur.
 * Tez matrisini ve detaylı tez kayıtlarını yerleştirir,
 * Gemini'den her tezi 4 eksende karşılaştırmasını ister.
 *
 * @param params - Matris alanları ve zenginleştirilmiş tez detay listesi
 * @returns Gemini'ye gönderilmeye hazır prompt metni
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
Aşağıda hedef tez matrisi yer almaktadır:
<studyTitle>${params.studyTitle}</studyTitle>
<researchQuestion>${params.researchQuestion}</researchQuestion>
<mainClaim>${params.mainClaim}</mainClaim>
<methodology>${params.methodology}</methodology>
<theoreticalFramework>${params.theoreticalFramework}</theoreticalFramework>
<historicalSpatialLimits>${params.historicalSpatialLimits}</historicalSpatialLimits>

Karşılaştırılacak Tezlerin Detayları:
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
`;
}
