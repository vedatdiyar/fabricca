/**
 * Builds the box-type context block embedded in the system instruction.
 *
 * @param boxType - Box type identifier of the thesis sub-box.
 * @param subBoxTitle - Title of the thesis sub-box.
 * @param description - Description of the thesis sub-box.
 * @param thesisSubject - Subject of the thesis.
 * @returns The formatted box context block for the jury prompt.
 */
function buildBoxTypeInstruction(
  boxType: string,
  subBoxTitle: string,
  description: string,
  thesisSubject: string,
): string {
  return `Kutu Türü: ${boxType}
Kutu Başlığı: ${subBoxTitle}
Kutu Açıklaması: ${description}
Tez Konusu: ${thesisSubject}`;
}

/**
 * Builds box-type-specific acceptance and rejection guidelines for the jury.
 *
 * @param boxType - Box type identifier used to select the matching guideline block.
 * @returns The quadrant-specific evaluation guideline text, or an empty string when unsupported.
 */
function buildQuadrantSpecificInstruction(boxType: string): string {
  switch (boxType) {
    case "SUBJECT_PROBLEM":
      return `
═══════════════════════════════════════════════════════════════════════════════
KUTU TÜRE ÖZGÜ DEĞERLENDİRME REHBERİ — VAKA / KONU KUTUSU (SUBJECT_PROBLEM)
═══════════════════════════════════════════════════════════════════════════════

Amaç: Bu kutu tezin doğrudan incelediği ampirik vakaya, spesifik tarihsel
döneme ve aktörlere odaklanır.

## KABUL KRİTERİ
Tezin kapsadığı tarihsel dönemi ve vaka alanını doğrudan işleyen ampirik monografiler,
saha araştırmaları ve vaka analizleri yüksek puan (80-95+) almalıdır.
Temel monografiler "çok genel" diye cezalandırılamaz; isFoundational: true
için bu ampirik temel eserler önceliklendirilmelidir.

## ZORUNLU ELEME (RED) KRİTERLERİ
isRelevant: false, score < 30, isFoundational: false

1. Tezin kapsadığı olgusal/tarihsel dönemin DIŞINDAKİ başka bir döneme veya
   olaya (örneğin tezin kapsadığı yıllar dışındaki başka bir barış sürecine
   veya savaş kesitine) odaklanan çalışmalar.

2. Soyut, genel ve zamansız teorik/kuramsal eserler (Örn: genel iç savaş
   şiddeti teorileri, Foucault veya Gramsci gibi düşünürlerin genel teorileri)
   ve metodoloji el kitapları. Bu eserler teorik/yöntemsel zenginlik taşısalar
   bile Vaka/Konu Kutusu (SUBJECT_PROBLEM) için TAMAMEN ALAKASIZDIR.`;

    case "THEORETICAL_FRAMEWORK":
      return `
═══════════════════════════════════════════════════════════════════════════════
KUTU TÜRE ÖZGÜ DEĞERLENDİRME REHBERİ — TEORİK ÇERÇEVE KUTUSU (THEORETICAL_FRAMEWORK)
═══════════════════════════════════════════════════════════════════════════════

Amaç: Bu kutu tezin ampirik vakasını anlamlandırmada kullanılan soyut
kuramlar, teorik kavramlar ve modellemelere odaklanır.

## KABUL KRİTERİ
İlgili kuramcıların birincil kuramsal metinleri ve bu teorileri tartışan
literatür yüksek puan almalıdır.

## RED KRİTERİ
Teorisiz sadece ampirik vaka anlatan veya teknik metodoloji sunan eserler
düşük puan almalıdır.`;

    case "METHODOLOGY":
      return `
═══════════════════════════════════════════════════════════════════════════════
KUTU TÜRE ÖZGÜ DEĞERLENDİRME REHBERİ — YÖNTEM KUTUSU (METHODOLOGY)
═══════════════════════════════════════════════════════════════════════════════

Amaç: Bu kutu metodolojik, analitik ve yöntemsel eserlere odaklanır. Makaleler
aşağıdaki üç tipte sınıflandırılır ve puanlanır.

────────────────────────────────────────────────────
(A) BİRİNCİL ÖNCELİK — Metodolojik Kılavuz (PUAN: 80-100)
────────────────────────────────────────────────────
Doğrudan yöntemin adımlarını, kodlama prosedürünü, analiz tekniklerini ve
araştırma tasarımını anlatan el kitapları (handbook/manual), yöntem kitapları
(methodology textbooks/guides), araştırma tasarımı makaleleri ve uygulamalı
analiz prosedürü kılavuzları EN YÜKSEK PUANI (80-100) almalıdır. Bu eserler
isFoundational=true olarak işaretlenebilir.

────────────────────────────────────────────────────
(B) İKİNCİL ÖNCELİK — Emsal Uygulama (PUAN: 60-79)
────────────────────────────────────────────────────
Yöntemi doğrudan kılavuz olarak anlatmasa da yöntemi ilgili disiplindeki emsal
bir vakaya metodolojik derinlikle uygulayan nitelikli çalışmalar ORTA-YÜKSEK
PUAN (60-79) almalıdır. Yöntemin sınırlarını ve uygulama inceliklerini tartışan
eserler bu kategoride değerlendirilir. isFoundanical=false.

────────────────────────────────────────────────────
(C) KESİN RED / DÜŞÜK ÖNCELİK — Felsefi/Genel Kuramlar & Yüzeysel Çalışmalar (PUAN: 0-40)
────────────────────────────────────────────────────
Foucault, Butler, Derrida gibi düşünürlerin salt felsefi/soyut teorik eserleri,
yöntemin inceliklerini anlatmayan düz ampirik yazılar (sadece sonuç raporu,
yöntemsiz vaka anlatısı) ve metodoloji içermeyen genel sosyal teori metinleri
DÜŞÜK PUAN (0-40) almalıdır. Bu eserler isRelevant=false olarak işaretlenmelidir.`;

    default:
      return "";
  }
}

/**
 * Builds the system instruction for the single-box jury LLM call.
 *
 * @param boxType - Box type identifier of the thesis sub-box.
 * @param subBoxTitle - Title of the thesis sub-box.
 * @param description - Description of the thesis sub-box.
 * @param thesisBoxId - Identifier of the thesis sub-box in the database.
 * @param thesisSubject - Subject of the thesis.
 * @returns The full system instruction prompt for the jury LLM call.
 */
export function buildJurySystemInstruction(
  boxType: string,
  subBoxTitle: string,
  description: string,
  thesisBoxId: number,
  thesisSubject: string,
): string {
  const boxTypeInstruction = buildBoxTypeInstruction(
    boxType,
    subBoxTitle,
    description,
    thesisSubject,
  );

  const quadrantBlock = buildQuadrantSpecificInstruction(boxType);

  return `# Rol ve Uzmanlık

Sen, akademik makaleleri belirli bir tez alt kutusu bağlamında değerlendiren uzman bir akademik jüri üyesisin.

# Birincil Görev

Her bir makaleyi, içinde bulunduğu alt kutunun türü, başlığı ve açıklaması ile karşılaştırarak değerlendir. Makalenin kutu bağlamıyla doğrudan alakalı olup olmadığına karar ver, 0-100 arası gerçek alaka skoru belirle, kurucu eser (foundational work) olup olmadığını işaretle ve 1 cümlelik Türkçe gerekçe yaz.

# Kutu Bağlamı

${boxTypeInstruction}

# Genel Değerlendirme Kuralları

Sadece soyut teorik/kavramsal benzerliklere odaklanma. Makalenin incelediği spesifik olgunun, aktörlerin ve tarihsel kesitin; Sub-Box bağlamı ve tezin kapsadığı olgusal/tarihsel çerçeve ile bütünsel olarak örtüşüp örtüşmediğini değerlendir.

Eğer bir makale açıkça tezin ve kutunun kapsadığı tarihsel/olgusal dönemin DIŞINDAKİ başka bir döneme veya olaya odaklanıyorsa; kavramlar ne kadar benzer olursa olsun BU TEZ İÇİN ALAKASIZDIR.

Tezin kapsadığı tarihsel dönemi ve vaka alanını doğrudan işleyen kapsayıcı temel monografileri ve saha çalışmalarını "çok genel" diyerek cezalandırma. Bu eserler tezin ampirik ve tarihsel zeminini oluşturduğu için yüksek relevans puanı (80-95+) almalıdır.${quadrantBlock}

# Ko-Atıf Lideri Notu

isCoCitationLeader=true olan eserler, taranan makalelerin ortak kaynakçasında en çok atıf yapılan temel referans adaylarıdır. Değerlendirirken bu akademik bağlamsal ağırlığı göz önünde bulundur.

# Değerlendirme Kriterleri

- Her makale için başlık, abstract metni ve OpenAlex relevance_score bilgisi verilmiştir.
- Makalenin kutu bağlamına uygunluğunu değerlendir.
- Sadece gerçekten kurucu metinler için isFoundational=true kullan.
- Dönemsel sapma gösteren çalışmalar kesinlikle düşük puan almalıdır.

# Çıktı Biçimi

Her değerlendirme için aşağıdaki alanları içeren JSON nesneleri dizisi döndürün:
- thesisBoxId: ${thesisBoxId}
- subBoxTitle: "${subBoxTitle}"
- articleTitle: makale başlığı (aynen)
- isRelevant: boolean
- relevanceScore: 0-100 arası tam sayı
- isFoundational: boolean
- reasoning: Türkçe 1 cümlelik gerekçe`;
}

/**
 * Builds the user prompt for the single-box jury LLM call.
 *
 * @param thesisSubject - Subject of the thesis.
 * @param thesisBoxId - Identifier of the thesis sub-box in the database.
 * @param subBoxTitle - Title of the thesis sub-box.
 * @param boxType - Box type identifier of the thesis sub-box.
 * @param description - Description of the thesis sub-box.
 * @param articlesText - Serialized text of the articles to evaluate.
 * @param articleCount - Number of articles included in the prompt.
 * @returns The formatted user prompt for the jury LLM call.
 */
export function buildJuryUserPrompt(
  thesisSubject: string,
  thesisBoxId: number,
  subBoxTitle: string,
  boxType: string,
  description: string,
  articlesText: string,
  articleCount: number,
): string {
  return `# Girdi Bağlamı

Tez Konusu (Subject Problem): ${thesisSubject}

Kutu: [Box ${thesisBoxId}] "${subBoxTitle}" (${boxType})
Açıklama: ${description}

Makaleler:
${articlesText}

# İşlem

Yukarıdaki ${articleCount} makaleyi değerlendir ve her biri için thesisBoxId, subBoxTitle, articleTitle, isRelevant, relevanceScore (0-100), isFoundational, reasoning (Türkçe) alanlarını içeren JSON dizisi döndür.`;
}
