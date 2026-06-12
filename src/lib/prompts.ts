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
    keywords: {
      type: "array",
      items: { type: "string" },
      description:
        "Exactly 5 core English keywords/words (no quotes, single words, root forms).",
    },
  },
  required: ["tavilyQueries", "keywords"],
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
          result: { type: "string", enum: ["VERIFIED", "PARTIALLY_VERIFIED", "REFUTED"] },
          resultNote: { type: "string" },
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

export const deepSiftingSchema: JsonSchema = {
  type: "object",
  properties: {
    selectedThesisIds: {
      type: "array",
      items: { type: "number" },
      description:
        "Exactly 5 thesis IDs that pose the highest risk of overlap or threat to originality.",
    },
  },
  required: ["selectedThesisIds"],
};

/**
 * Tez matrisini yapısal kutulara (boxes) ayıracak olan JSON şeması.
 * Gemini'den boxes dizisi beklenir. Her kutuda category, title, description,
 * theorists, concepts, queries, primaryLiterature ve secondaryLiterature bulunur.
 */
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
- Kullanıcının girdiği kavramsal sütunları akademik olarak zenginleştirin. Mevcut kavramlarla (örn. Marx ve Foucault) doğrudan organik bağı olan, literatürde kabul görmüş demirbaş teorisyenleri veya kavramsal köprüleri (örn. Lazzarato) eklemekte özgürsünüz. Ancak çalışmanın ana eksenini kullanıcının niyetinden tamamen saptıracak radikal ve alakasız teorik makas değişiklikleri yapmayın.
- Kullanıcının beyan ettiği ampirik yönteme (örn. mülakat, anket) KESİNLİKLE sadık kalın. Kullanıcı açıkça belirtmediği sürece, yöntemin üzerine kafanıza göre felsefi/epistemolojik ekoller veya spesifik analiz türleri (örn. 'Foucaultcu söylem analizi', 'fenomenolojik yaklaşım') YAKIŞTIRMAYIN. Metodolojik sınırları kullanıcı çizmelidir.
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
2. Tezara için KESİNLİKLE ve SADECE 5 adet bağımsız İngilizce "Altın Anahtar Kelime" (keywords) üretmelisiniz.
   - Her kelime kesinlikle tek bir kelime olmalı, ek almamış yalın (kök) biçimde olmalı, tırnak işareti veya özel karakter içermemelidir.
   - Bu 5 anahtar kelime, çalışmanın hem teorik sütunlarını hem de ampirik/bağlamsal boyutlarını en iyi temsil eden terimler olmalıdır (örn. "hegemony", "neoliberalism", "debt", "Turkey", "crisis").
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
- Değerlendirilen olguların bir listesini oluşturun. Her olgu için result alanına "VERIFIED", "PARTIALLY_VERIFIED" veya "REFUTED" değerlerinden birini atayın. Ayrıntılı akademik analizi ve gerekçeyi resultNote alanında Türkçe olarak belirtin.
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
Akademik bir araştırmacısınız. Size akademik tezlerin bir listesi (ID, başlık ve anabilim dalı/bölüm şeklinde) ve hedef tez matrisi verilmektedir.
Göreviniz, hedef tez matrisine göre "kesinlikle alakasız" olan tezleri (örneğin tıp, mimarlık, inşaat gibi tamamen farklı disiplinlerdeki tezleri) ayıklamak ve potansiyel olarak ilişkili olabilecek tezlerin kimliklerini (ID) seçmektir.
</role>

<constraints>
- Bu kaba eleme (Stage 1) aşamasında son derece esnek ve temkinli olun. Sadece KESİNLİKLE alakasız olanları eleyin.
- Geriye kalan ve potansiyel olarak alakalı olan tüm tezlerin kimliklerini (ID) "relevantThesisIds" dizisinde döndürün. Yaklaşık 40-50 tezi seçmeye çalışın.
- Yalnızca şemayla eşleşen geçerli bir JSON ile yanıt verin.
</constraints>
`;

export const DEEP_SIFTING_SYSTEM_INSTRUCTION = `
<role>
Kıdemli bir akademik danışman ve özgünlük değerlendirme uzmanısınız. Size hedef tez matrisi ve Stage 1'den geçerek rafine edilmiş, detaylı özetleri (abstract) içeren akademik tezlerin listesi verilmektedir.
Göreviniz, bu aday tezlerin abstract (özet), başlık ve konu/bölüm detaylarını inceleyerek, kullanıcının çalışmasının özgünlüğünü/iddiasını en çok tehdit eden en kritik tam 5 tezi seçmektir.
</role>

<constraints>
- Aday tezlerin başlıklarını ve özetlerini (abstract) derinlemesine analiz edin.
- Kullanıcının çalışmasıyla en yüksek derecede örtüşme, benzerlik veya çakışma riski barındıran KESİNLİKLE ve TAM 5 tezin ID'sini seçin.
- Ne daha az ne daha fazla, tam 5 adet tez ID'si döndürmelisiniz.
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

/**
 * Tez matrisini 5 ana kategoriye göre yapısal kutulara (boxes) ayırmak için kullanılan sistem talimatı.
 * Akademik bir sosyal bilimci persona ile çalışarak, ampirik/yerel kutularda
 * halüsinasyonu filtrelemeyi ve arama sorgularını çeşitlendirmeyi hedefler.
 */
export const THESIS_BOX_GENERATION_SYSTEM_INSTRUCTION = `
<thesis_box_generation>
<system_instruction>Sen kıdemli bir sosyal bilimler akademisyenisin. Görevin, verilen tez matrisini bağımsız, literatür taramasına uygun yapısal kutulara (box) bölmektir.</system_instruction>

<categories>Kutuları şu 5 kategoriye ayır: intro (Giriş ve temel iddia - fix 1 adet), theory (Teorik zemin), methodology (Yöntem literatürü), context (Tarihsel/Mekansal bağlam), primary_source (İncelenen birincil özneler/arşivler).</categories>

<hallucination_filter>(Karar 11) context ve primary_source gibi yerel/ampirik kutularda, eğitim verinden %100 emin olmadığın hiçbir birincil/ikincil kaynağı ve yazarı uydurma. Emin değilsen bu alanları boş array [] bırak ve gücünü arama sorgularına (queries) ver.</hallucination_filter>

<query_diversification>(Karar 12) Her kutu için üretilecek queries dizisi hem Türkçe hem İngilizce olmalı; dar (teorisyen odaklı), geniş (kavramsal) ve ilişkisel olmak üzere en az 3 farklı varyasyon içermelidir.</query_diversification>

<box_independence>(Karar 7) Kutular izoledir. Teori kutusunun literatür alanına tezin yerel öznelerini (Örn: Türkiye solu) karıştırma. Sadece o teoriyi inceleyen kaynakları yaz.</box_independence>
</thesis_box_generation>

<constraints>
- Gemini'nin döneceği çıktının tamamı akıcı, elit bir akademik Türkçe ile yazılmalıdır (kategori anahtarları hariç, onlar şemadaki ingilizce enum'lar olmalıdır).
- theorists, concepts, queries, primaryLiterature, secondaryLiterature dizileri eğer boş kalacaksa null veya undefined değil, kesinlikle boş bir dizi [] olarak döndürülmelidir.
- Yalnızca sağlanan şema ile eşleşen geçerli bir JSON döndürün. Yanıtı \`\`\`json ... \`\`\` gibi markdown kod bloklarına sarmayın.
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
4. conceptualTheoreticalInfrastructure: Ham kuramsal çerçeve ve sınır bilgilerini kullanarak, çalışmanın hangi teorik merceklerle okunacağını ve hangi literatürle diyaloga gireceğini akademik dille açıklayın. Girdideki teorik odağı genişletirken, mevcut kavramlarla doğrudan bağdaşan literatür köprülerini kullanın.
5. academicMethodologyDesign: Ham metodoloji tanımını, kullanıcının seçtiği temel yönteme sadık kalarak akademik bir araştırma tasarım diline dönüştürün. Kullanıcının beyan etmediği spesifik epistemolojik ekolleri (etnografi, fenomenoloji, söylem analizi vb.) kendi kafanızdan yakıştırmayın veya çalışmayı bu ekollere zorlamayın.
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

Olgusal Tavily sorgularını ve diller arası İngilizce Tezara kelimelerini çıkarın.
KRİTİK: JSON nesnesinde "tavilyQueries" için KESİNLİKLE ve SADECE 5 adet sorgu ve "keywords" için KESİNLİKLE ve SADECE 5 adet bağımsız İngilizce anahtar kelime üretmelisiniz.
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

Aramadan elde edilen aday tezlerin listesi (ID, Başlık, Bölüm):
${JSON.stringify(
  params.uniqueTheses.map((t) => ({
    id: t.id,
    title: t.title,
    department: t.department,
  })),
)}

Lütfen hedef tez matrisi ile temel bilim dalı, konu alanı veya teorik odak açısından KESİNLİKLE alakasız olan (örneğin tıp, mimarlık, inşaat mühendisliği vb.) tezleri ayıklayarak, potansiyel olarak alakalı olabilecek tüm tezlerin ID'lerini seçin.
Amacımız kesinlikle alakasız olanları elemek ve potansiyel olarak alakalı ~40-50 tezi tutmaktır. Geriye kalan potansiyel tez ID'lerini "relevantThesisIds" dizisinde döndürün.
`;
}

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
Hedef Tez Matrisi:
- Başlık: ${params.studyTitle}
- Konu/Araştırma Sorusu: ${params.researchQuestion}
- Teori: ${params.theoreticalFramework}
- Metodoloji: ${params.methodology}
- Bağlam: ${params.historicalSpatialLimits}

Aday Tezlerin Detayları:
${JSON.stringify(
  params.candidateDetails.map((t) => ({
    id: t.id,
    title: t.title,
    department: t.department,
    abstract: t.abstract,
  })),
)}

Lütfen yukarıdaki aday tezlerin özetlerini (abstract) ve başlıklarını inceleyerek, hedef tezimizin özgünlüğünü en çok tehdit eden en kritik TAM 5 tezi seçin.
Geriye tam 5 adet tez ID'si içeren "selectedThesisIds" dizisi döndürün.
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

/**
 * Tez matrisini alıp 5 ana kategoriye göre yapısal kutulara (boxes) bölmek için
 * kullanıcı promptunu oluşturur.
 *
 * @param params - Doğrulanmış tez matrisi alanları
 * @returns Gemini'ye gönderilmeye hazır prompt metni
 */
export function buildThesisBoxGenerationPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  methodology: string;
  theoreticalFramework: string;
  historicalSpatialLimits: string;
}): string {
  return `<context>
Aşağıda zenginleştirilmiş/doğrulanmış tez matrisi verileri yer almaktadır:

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
Yukarıdaki tez matrisini analiz ederek, <thesis_box_generation> altındaki kurallara uygun olarak literatür taraması süreçlerini yönetebileceğimiz yapısal kutulara (boxes) bölün.
Her bir kutu için kategori, başlık, açıklama, teorisyenler, kavramlar, arama sorguları, birincil literatür ve ikincil literatür bilgilerini belirleyip şemaya uygun bir şekilde döndürün.
</task>`;
}
