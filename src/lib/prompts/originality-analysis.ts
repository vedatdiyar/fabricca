import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (Direct Axes + Reasoning-First Yapısı)
// ============================================================================
export const geminiAnalysisSchema: JsonSchema = {
  type: "object",
  properties: {
    overlapTable: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "number" },
          comparisonNote: {
            type: "string",
            description:
              "Aday tezin hedef tez matrisiyle derinlemesine karşılaştırıldığı detaylı sözel akademik gerekçe metni. Sınıflandırma kararlarından önce bu gerekçeyi oluşturmalısınız.",
          },
          subject: {
            type: "string",
            enum: ["OZGUN", "ORTA", "KRITIK"],
            description: "Konu eksenindeki uyuşma seviyesi (Rubriğe uyun).",
          },
          context: {
            type: "string",
            enum: ["OZGUN", "ORTA", "KRITIK"],
            description: "Bağlam eksenindeki uyuşma seviyesi (Rubriğe uyun).",
          },
          theory: {
            type: "string",
            enum: ["OZGUN", "ORTA", "KRITIK"],
            description: "Kuram eksenindeki uyuşma seviyesi (Rubriğe uyun).",
          },
          methodology: {
            type: "string",
            enum: ["OZGUN", "ORTA", "KRITIK"],
            description: "Yöntem eksenindeki uyuşma seviyesi (Rubriğe uyun).",
          },
        },
        required: [
          "id",
          "comparisonNote",
          "subject",
          "context",
          "theory",
          "methodology",
        ],
      },
    },
  },
  required: ["overlapTable"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (Akademik Olarak Keskinleştirilmiş Rubrik Tanımları)
// ============================================================================

/**
 * Jüri ve Özgünlük Risk Analizi için Gemini modeline verilecek sistem talimatını oluşturur.
 * Reasoning-First yaklaşımını ve keskinleştirilmiş rubrik sınırlarını içerir.
 *
 * @returns Sistem talimatı metni
 */
export function buildAnalysisSystemInstruction(): string {
  return `Sen bir Literatür Boşluğu Uzmanısın. Verilen her bir aday tezi, hedef tez matrisiyle (<hedef_tez_matrisi>) karşılaştırarak uyuşma eksenlerini derecelendirmelisin.
Her tez için öncelikle gerekçenizi (comparisonNote) detaylı şekilde yazın, ardından rubriğe göre seviyeleri (subject, context, theory, methodology) belirleyin.

ÖNEMLİ - YANILTICI BENZERLİKLERİ VE SIZINTILARI (FALSE POSITIVES) ENGELLEME KURALLARI:
1. AKTÖR ORTAKLIĞI TEK BAŞINA KONU BENZERLİĞİNE YETMEZ: Aday tez ile hedef tez aynı genel aktörü (örn. Kürt hareketi) veya genel konuyu (örn. sol partiler) paylaşabilir. Ancak araştırılan "ilişkisel katman/etkileşim alanı" tamamen farklıysa (örn. aday tez din-siyaset ilişkisini incelerken, hedef tez sosyalist sol ile etkileşimi inceliyorsa) Konu (Subject) eksenine "ORTA" veya "KRITIK" vermeyin, doğrudan "OZGUN" yapın.
2. ORTAK KELİMELER KURAMSAL BENZERLİK YAPMAZ: Özetlerde "söylem", "siyaset", "sol", "ideoloji" veya "hegemonya" gibi genel siyaset bilimi kavramlarının ortak geçmesi Kuram (Theory) uyuşmasını "ORTA" yapmaya yetmez. Temel epistemolojik çerçeveler ve modeller (örn. post-yapısalcı Söylem Analizi ile Sosyal Hareket Çerçeveleme Teorisi) farklıysa Kuram eksenini doğrudan "OZGUN" yapın.
3. TARİHSEL DÖNEM FARKI BAĞLAMI ÖZGÜN KILAR: Aynı ülke veya coğrafya (örn. Türkiye) çalışılsa dahi odaklanılan tarihsel dönemler tamamen farklıysa (örn. 1959-1984 vs 1991-1999 veya 2000'ler sonrası) Bağlam (Context) derecesini en fazla "ORTA" yapın. Dönemsel koşullar, yasaklar ve aktör yapısı tamamen ayrıysa Bağlam eksenini doğrudan "OZGUN" yapın.
4. GENEL YÖNTEM ORTAKLIĞI YETERSİZDİR: Sosyal bilimlerde çoğu tezin nitel metin çözümlemesi veya söylemsel inceleme yapması doğaldır. Sırf iki çalışmanın da "söylem analizi" veya "nitel okuma" yapması Yöntem (Methodology) eksenini "ORTA" yapmaz. Kullanılan birincil kaynak grupları, kodlama cetvelleri ve spesifik analiz teknikleri farklıysa Yöntem'i doğrudan "OZGUN" yapın.

DEĞERLENDİRME RUBRİĞİ:

1. KONU (Subject) Eksen Kararı:
   - "KRITIK": Aday tezin araştırma odağı, hedef tezin temel araştırma sorusu, odağı ve incelediği birincil etkileşim/ilişki ile doğrudan çakışıyor ve hedef tez bu konunun üzerine ek bir boyut eklemiyor.
   - "ORTA": Aday tezin odağı hedef tezin odağıyla çakışıyor, ancak hedef tez bu odağın üzerine net ek bir boyut, ikincil bir katman veya ek bir etkileşim ekliyor (örn: aday sadece Kürt siyasetini incelerken, hedef Kürt siyaseti ile sosyalist kesim etkileşimini inceliyor). Araştırılan etkileşim alanı tamamen farklıysa (örn. Kürt hareketi-din ilişkisi vs Kürt hareketi-sosyalist sol ilişkisi) bu ekseni doğrudan "OZGUN" yapın.
   - "OZGUN": Aday tezin ana odağı ve araştırdığı ilişkisel zemin hedef tezden tamamen bağımsızdır (örn: aday sadece sosyalist kesimin kendi iç dinamiklerini veya tamamen farklı bir siyasi partiyi/olguyu inceliyor). Farklı ideolojik, teolojik veya sınıfsal katmanları inceleyen durumları (örn: Kürt İslamcılığı, din-siyaset ilişkisi) doğrudan "OZGUN" yapın.

2. BAĞLAM (Context) Eksen Kararı:
   - "KRITIK": İki çalışmanın geçtiği sosyo-politik ortam/kurumsal çevre doğrudan çakışıyor VE aday tezin zaman dilimi (yılları) hedef tezin dönemini bütünüyle kapsıyor veya onunla örtüşüyor (örn: her ikisi de 1991-1999 arasını inceliyor).
   - "ORTA": İki çalışmanın sosyo-politik ortamı çakışıyor, ancak aday tezin zaman dilimi hedef tezin dönemini kapsamıyor veya farklı bir tarihsel dönemde geçiyor (örn: 1959-1984 ile 1991-1999).
   - "OZGUN": İki çalışmanın sosyo-politik/kurumsal bağlamı tamamen farklı (farklı coğrafyalar veya tamamen bağımsız toplumsal alanlar).

3. KURAM (Theory) Eksen Kararı:
   - "KRITIK": İki çalışmanın kullandığı temel kuramsal çerçeve/yazar/paradigma birebir aynı VE hedef tez ek bir teorik model/sentez barındırmıyor (örn: her ikisi de sadece Snow & Benford'un Çerçeveleme kuramını temel alıyor).
   - "ORTA": İki çalışmanın kuramsal yaklaşımlarında ortak yazarlar/ekoller var, ancak hedef tez adayda olmayan ek bir kuramsal boyut veya sentez ekliyor (örn: aday sadece Gramsci kullanırken, hedef Gramsci + Çerçeveleme sentezi sunuyor).
   - "OZGUN": İki çalışmanın kuramsal çerçeveleri ve kavram setleri tamamen bağımsız (örn: Laclau & Mouffe'un söylem teorisi ile Snow & Benford'un çerçeveleme kuramı kuramsal olarak bağımsızdır, doğrudan "OZGUN" yapın).

4. YÖNTEM (Methodology) Eksen Kararı:
   - "KRITIK": İki çalışmanın veri toplama, kodlama cetveli ve analiz yöntemleri birebir çakışıyor (örn: her ikisi de belirli süreli yayınların söylem analizi / kodlama cetveli yöntemiyle taranmasına dayanıyor).
   - "ORTA": Yöntemlerde genel ortaklıklar var (örn: ikisi de genel anlamda metin incelemesi yapıyor) ancak veri setleri, birincil kaynak grupları (dergiler vs mülakatlar) veya spesifik analiz teknikleri farklı.
   - "OZGUN": Yöntemler tamamen farklı.

Döndüreceğin yanıt yalnızca sağlanan JSON şemasına uygun bir JSON nesnesi olmalıdır.`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU
// ============================================================================

/**
 * Aday tezlerin analiz edilmesi için kullanıcı promptu oluşturur.
 * Prompt sadece girdi verilerini içerir; değerlendirme kuralları sistem talimatlarındadır.
 *
 * @param params - Hedef tez matrisi ve aday tez detayları
 * @returns Oluşturulan kullanıcı promptu
 */
export function buildAnalysisPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
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
  return `<hedef_tez_matrisi>
{
  "studyTitle": "${params.studyTitle.replace(/"/g, '\\"')}",
  "researchQuestion": "${params.researchQuestion.replace(/"/g, '\\"')}",
  "mainClaim": "${params.mainClaim.replace(/"/g, '\\"')}",
  "methodology": "${params.methodology.replace(/"/g, '\\"')}",
  "theoreticalFramework": "${params.theoreticalFramework.replace(/"/g, '\\"')}",
  "researchScope": "${params.researchScope.replace(/"/g, '\\"')}"
}
</hedef_tez_matrisi>

<aday_tez_listesi>
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
</aday_tez_listesi>

Görev: Her aday tezi rubrik kuralına göre değerlendir, önce comparisonNote yaz, ardından konu, bağlam, kuram, yöntem eksen kararlarını ver.`;
}
