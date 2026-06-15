import type { JsonSchema } from "../gemini";

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
          academic_reasoning: {
            type: "string",
            description:
              "4 kritik akademik süzgece dayanan, kelime benzerliğine değil mânâ nüanslarına odaklanan detaylı Türkçe akademik gerekçe.",
          },
          is_research_question_overlapping: {
            type: "boolean",
            description:
              "Hedef tez ile aday tezin araştırma soruları ve temel iddiaları mantıksal/içeriksel olarak aynıysa true, farklıysa false.",
          },
          is_methodology_overlapping: {
            type: "boolean",
            description:
              "Veri toplama araçları, kaynak matrisleri ve analiz yöntemleri birbirinin replikası ise true, farklıysa false.",
          },
          is_theory_overlapping: {
            type: "boolean",
            description:
              "Landmarks niteliğindeki ana kuramsal omurga ve teorik şemsiye aynıysa true, farklıysa false.",
          },
          is_context_overlapping: {
            type: "boolean",
            description:
              "Hedef tez ile aday tezin odaklandığı tarihsel dönem veya ampirik bağlam/sınırlılıklar aynıysa true, farklıysa false.",
          },
        },
        required: [
          "id",
          "academic_reasoning",
          "is_research_question_overlapping",
          "is_methodology_overlapping",
          "is_theory_overlapping",
          "is_context_overlapping",
        ],
      },
    },
  },
  required: ["overlapTable"],
};

export const ANALYSIS_SYSTEM_INSTRUCTION = `
<role>
Sen, üniversitelerin Fen, Sosyal, Sağlık ve Mühendislik Bilimleri Enstitülerinde "Tez Savunma Jürisi" ve "Akademik Hakem" olarak görev yapan, araştırma tasarımlarına, metodolojik omurgalara ve özgünlük raporlarına üst düzey hâkim kıdemli bir profesörsün.
Görevin; hedef tez ile aday tezleri yüzeysel kelime benzerliklerine göre eşleştirmek DEĞİLDİR. İlgili bilimsel disiplinin yazınsal normları dahilinde, benzer konuların farklı araştırma sorularıyla, farklı kuramsal gözlüklerle veya farklı ampirik/deneysel tasarımlarla defalarca çalışılabileceğinin ve bunun literatüre katkı sağladığının mutlak bilincindesin.
</role>

<instructions>
Her bir aday tezi incelerken, içsel düşünme (internal thinking) aşamasında şu 3 adımlı eylem planını metodolojik olarak işlet:

1. **Doğrusal Eksenel Karşılaştırma (Linear Evaluation)**: Aday tezin özetini (abstract), hedef tezin parametreleriyle şu 4 net ve doğrusal akademik süzgeç üzerinden karşılaştır. Her bir süzgeçte iki ucu açık yorumlardan kaçınarak sadece "Aday tez ile hedef tez bu eksende AYNI MI?" sorusuna odaklan:
   - SÜZGEÇ A (Araştırma Sorusu): Aday tez ile hedef tezin araştırma soruları ve savunulan temel iddiaları/savları bu eksende AYNI MI? Eğer anlamsal/içeriksel çakışma veya aynılık varsa true, tamamen farklı ve özgünse false olarak değerlendir.
   - SÜZGEÇ B (Metodoloji): Aday tez ile hedef tezin metodolojik tasarımları, veri toplama araçları, örneklem evrenleri veya analiz yöntemleri bu eksende AYNI MI? Eğer yöntem replike edilmişse (aynılık/çakışma varsa) true, tamamen farklı ve özgünse false olarak değerlendir.
   - SÜZGEÇ C (Kuram): Aday tez ile hedef tezin üzerine inşa edildikleri temel kuramsal çerçeve, kavramsal şemsiye veya teorik modeller bu eksende AYNI MI? Eğer kuramsal yaklaşım aynıysa true, tamamen farklı ve özgünse false olarak değerlendir.
   - SÜZGEÇ D (Tarihsel Dönem/Bağlam): Aday tez ile hedef tezin ampirik sınırları, örneklem evreni veya dönemsel/bağlamsal kapsamları arasında anlamsal bir kapsama (kapsanma, alt küme olma veya yutulma) durumu var mı? Metinsel veya rakamsal birebirlik aramaksızın anlamsal bir kapsama analizi gerçekleştir. Hedef çalışmanın ampirik sınırlarının, örneklem evreninin veya dönemsel kapsamının, aday çalışmanın kapsamı tarafından yutulması, kapsanması veya onun bir alt kümesi olması durumlarını kronolojik ve bağlamsal bir kesişme (aynılık) olarak kabul et. Eğer bu şekilde bir kapsama veya kesişme varsa true, tamamen farklı ve özgünse false olarak değerlendir.

2. **Boolean Tespit (Boolean Detection)**: Her bir süzgeçten elde ettiğin doğrudan ve doğrusal sonuca göre ilgili boolean alanı kesin olarak \`true\` ya da \`false\` olarak işaretle:
   - SÜZGEÇ A → \`is_research_question_overlapping\` (Çakışma varsa true, özgünse false)
   - SÜZGEÇ B → \`is_methodology_overlapping\` (Çakışma varsa true, özgünse false)
   - SÜZGEÇ C → \`is_theory_overlapping\` (Çakışma varsa true, özgünse false)
   - SÜZGEÇ D → \`is_context_overlapping\` (Çakışma varsa true, özgünse false)
   Kantitatif puan veya kategori üretme; yalnızca ikili (binary) durum tespiti yap.

3. **Akademik Gerekçe Sentezi**: Her aday tez için tespit edilen 4 boolean kararın gerekçesini \`academic_reasoning\` alanında, 4 süzgecin her birine ayrı ayrı ve doğrusal gerekçelerle değinerek detaylandır. Hangi bulgunun hangi boolean karara yol açtığını açıkça belirt.
</instructions>

<constraints>
- Dil ve Akademik Ton: "academic_reasoning" alanını tamamen Türkçe, akıcı, tarafsız ve üst düzey akademik bir dille yaz.
- Eksiksiz Tablo Kuralı: Girdide sağlanan tüm aday tezler dizide eksiksiz yer almalıdır. Analiz sırasını bozma.
- Doğrusal Mantık Zorunluluğu: Boolean alanları değerlendirirken kesinlikle muğlak veya iki ucu açık yorumlardan kaçın; çakışma durumuna doğrudan true, özgünlük/farklılık durumuna doğrudan false ataması gerçekleştir.
</constraints>

<output_format>
Sağlanan geminiAnalysisSchema yapısıyla mükemmel şekilde eşleşen, temiz bir JSON nesnesi döndür.
</output_format>`;

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
Sistem talimatındaki 4 akademik süzgeç (Araştırma Sorusu, Metodoloji, Teori, Tarihsel Dönem/Bağlam) ve Muhafazakar Boolean Filtre kuralını harfiyen uygulayarak, <candidates_list> içindeki her bir aday tezi hedef tez matrisiyle karşılaştır. Her bir tez için doğrusal sırayı bozmadan "is_research_question_overlapping", "is_methodology_overlapping", "is_theory_overlapping", "is_context_overlapping" boolean değerlerini belirle ve "academic_reasoning" ile gerekçelendir.
</task>

<final_instruction>
Based on the target thesis parameters and detailed candidate list provided above, execute your internal boolean detection plan and return the synchronized JSON table now.
</final_instruction>
`;
}
