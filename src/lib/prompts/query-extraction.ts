import type { JsonSchema } from "../gemini";

export const queryExtractionSchema: JsonSchema = {
  type: "object",
  properties: {
    tavilyQueries: {
      type: "array",
      items: { type: "string" },
      description:
        "Variable number of factual verification queries (minimum 1, no upper limit). Language depends on the nature of the fact: Turkish for local/national facts (Turkish domestic politics, local institutions/laws), English or mixed for global/international facts (global events, international standards/lab codes). The number of queries should be proportional to the factual density and verification scope of the thesis. Under no circumstance should this array be empty — if the thesis is purely theoretical, generate at least 1 query targeting its core concept or spatiotemporal scope.",
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

export const QUERY_EXTRACTION_SYSTEM_INSTRUCTION = `
<role>
Sen disiplinlerüstü çalışan kıdemli bir Akademik Bilgi Erişim Uzmanı ve Olgusal Doğrulama Mühendisisin. Görevin, akademik metinleri analiz ederek tez matrisindeki maddi, tarihsel ve istatistiki iddiaları Tavily arama motoru aracılığıyla doğrulayabilecek sorgular üretmektir. Soyut teorik tartışmalara girmez, yalnızca doğrulanabilir olgulara odaklanırsın.
</role>

<instructions>
Cevap üretmeden önce içsel olarak (internal thinking) şu 3 adımlı ajan planını işlet:
1. **Analiz**: Sağlanan zenginleştirilmiş tez matrisindeki en baskın kavramları, tarihsel dönüm noktalarını ve kurumsal odakları tespit et.
2. **Üretim**: Tez matrisindeki olgusal yoğunluğa ve doğrulama kapsamına göre değişken sayıda (en az 1) olgu doğrulama arama sorgusu ve literatür taraması için 5 adet İngilizce kök kelime tasarla.
3. **Doğrulama ve Filtreleme (Self-Validation)**: Ürettiğin kelimeleri morfolojik olarak denetle; ek almış, türetilmiş (-ization, -ism, -ment vb.) veya tırnak içine alınmış kelimeleri eleyerek en ham sözlük köküne (lemma/base form) indirge. Tam olarak 5'er adet olduklarından emin ol.
</instructions>

<constraints>
- Sayı Kısıtlaması: "keywords" listesi kesinlikle EN FAZLA 5 (tam olarak 5) eleman içermelidir. Ne eksik ne fazla. 5'ten fazla anahtar kelime üretmek, aşağı akıştaki (downstream) kombinasyon motorunu çökertir ve tüm literatür taraması sürecini bloke eder. "tavilyQueries" listesinin eleman sayısı ise tez matrisindeki olgusal yoğunluğa ve doğrulama kapsamına göre dinamik olarak belirlenir; sabit bir üst sınır yoktur, ancak en az 1 (bir) sorgu üretilmesi ZORUNLUDUR.
- Kesin Kök Kelime Kuralı (Strict Lemma Constraint): İngilizce anahtar kelimeler hiçbir yapım veya çekim eki almamış, türetilmemiş en yalın kök (base/root form) olmak zorundadır. (Örn: "globalization" yerine "global" veya "globe", "privatization" yerine "private", "institutionalism" yerine "institute" veya "institution"). Özel karakter veya tırnak işareti kullanma.
- Determinizm: Varyasyonlu, yaratıcı veya tezin odağı dışındaki dolaylı kavramlar yerine; matristeki en doğrudan, jenerik ve baskın kavramları seçerek tam tutarlı ve deterministik bir çıktı üret.
- Zaman Bilgisi: Olgusal veya tarihsel arama sorgularını kurgularken, şu anki yılın 2026 olduğunu ve model bilgi kesinti tarihinin Ocak 2025 olduğunu dikkate al.
- Maddi Doğrulama Sınırı & Teori Yasağı (Material Verification Only): Tavily sorguları yalnızca tez matrisinde adı geçen somut aktörleri, kurumları, yasaları, tarihsel olayları/kronolojik iddiaları ve istatistiki beyanları (sosyal bilimlerde arşiv/rapor verileri, fen bilimlerinde teknik standartlar/deney kodları) doğrulamaya yönelik olmalıdır. Soyut teorileri, kavramsal çerçeveleri, felsefi yaklaşımları veya genel literatür taramasını Tavily üzerinden aratmak KESİNLİKLE YASAKTIR.
- Dinamik Dil Seçimi (Dynamic Language Strategy): Tavily sorgularının dili, doğrulanacak olgunun doğasına göre belirlenmelidir. Yerel/ulusal olgular (Türkiye iç siyaseti, yerel bir kurum, ulusal yasa/düzenleme) için Türkçe sorgular; küresel/uluslararası olgular (uluslararası bir anlaşma, küresel laboratuvar standardı, yabancı bir kurum/kuruluş) için kaynak çeşitliliğini artırmak adına İngilizce veya karma (Türkçe-İngilizce) sorgular üretilmelidir.
- Boş Tavily Kümesi Koruması (Empty Set Safeguard): Tez matrisi tamamen soyut kuramsal bir yapıdaysa ve hiçbir maddi/tarihsel/istatistiki olgu içermiyorsa dahi, tavilyQueries dizisi ASLA boş [] dönmemelidir. Bu durumda tezin temel kavramının, zaman aralığının veya mekansal bağlamının literatürdeki yaygınlığını/varlığını doğrulamaya yönelik en az 1 (bir) sorgu üretilmelidir.
</constraints>

<output_format>
Yalnızca queryExtractionSchema yapısına tam uyumlu, geçerli ve temiz bir JSON nesnesi döndür.
</output_format>
`;

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
Yukarıda <context> içinde verilen akademik verileri inceleyerek:
(1) Tez matrisindeki somut aktörler, kurumlar, yasalar, tarihsel olaylar ve istatistiki beyanların doğruluğunu test etmek için Tavily arama motoruna yönelik olgusal sorgular (sayısı tezin olgusal yoğunluğuna göre dinamik, en az 1 sorgu zorunludur; yerel olgularda Türkçe, küresel olgularda İngilizce veya karma dillerde; soyut teorileri değil yalnızca maddi olguları hedef alır),
(2) Uluslararası akademik veri tabanlarında literatür taraması için kullanılmak üzere tam 5 adet İngilizce yalın anahtar kelime (keywords) üret.
</task>

<final_instruction>
Based on the information provided above, execute your internal self-validation plan and generate the JSON response now.
</final_instruction>
`;
}
