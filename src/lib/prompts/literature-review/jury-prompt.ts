/**
 * Builds box-type-specific acceptance and evaluation guidelines for the jury.
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
Temel monografilere ampirik zemin sağladıkları için yüksek öncelik verilir.

## DEĞERLENDİRME VE ELEME KRİTERLERİ
isRelevant: false, score < 30

1. Tezin kapsadığı olgusal/tarihsel dönemin DIŞINDAKİ başka bir döneme veya
   olaya odaklanan çalışmalar düşük puanlandırılmalıdır.

2. Soyut, genel ve zamansız teorik/kuramsal eserler (ör. genel iç savaş
   şiddeti teorileri, Foucault veya Gramsci gibi düşünürlerin genel teorileri)
   ve metodoloji el kitapları Vaka/Konu Kutusu (SUBJECT_PROBLEM) için ayrı tutulmalıdır.`;

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

## DÜŞÜK ÖNCELİK KRİTERİ
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
analiz prosedürü kılavuzları EN YÜKSEK PUANI (80-100) almalıdır.

────────────────────────────────────────────────────
(B) İKİNCİL ÖNCELİK — Emsal Uygulama (PUAN: 60-79)
────────────────────────────────────────────────────
Yöntemi doğrudan kılavuz olarak anlatmasa da yöntemi ilgili disiplindeki emsal
bir vakaya metodolojik derinlikle uygulayan nitelikli çalışmalar ORTA-YÜKSEK
PUAN (60-79) almalıdır. Yöntemin sınırlarını ve uygulama inceliklerini tartışan
eserler bu kategoride değerlendirilir.

────────────────────────────────────────────────────
(C) DÜŞÜK ÖNCELİK — Felsefi/Genel Kuramlar & Yüzeysel Çalışmalar (PUAN: 0-40)
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
 * Builds the static system instruction for the single-box jury LLM call.
 *
 * @param boxType - Box type identifier of the thesis sub-box.
 * @returns The static system instruction prompt for the jury LLM call.
 */
export function buildJurySystemInstruction(boxType: string): string {
  const quadrantBlock = buildQuadrantSpecificInstruction(boxType);

  return `# Rol ve Uzmanlık

Sen, akademik makaleleri belirli bir tez alt kutusu bağlamında değerlendiren uzman bir akademik jüri üyesisin.

# Birincil Görev

Her bir makaleyi, sana verilen alt kutunun türü, başlığı ve açıklaması ile karşılaştırarak değerlendir. Makalenin kutu bağlamıyla doğrudan alakalı olup olmadığına karar ver, 0-100 arası alaka skoru belirle ve 1 cümlelik Türkçe gerekçe yaz.

# Genel Değerlendirme Kuralları

1. **Bütünsel Örtüşme:** Soyut teorik benzerliklerin ötesine geçerek makalenin incelediği spesifik olgunun, aktörlerin ve tarihsel kesitin; Sub-Box bağlamı ve tezin kapsadığı olgusal/tarihsel çerçeve ile bütünsel olarak örtüşüp örtüşmediğini değerlendir.
2. **Dönemsel Uygunluk:** Tezin ve kutunun kapsadığı tarihsel/olgusal dönemin dışındaki başka bir döneme veya olaya odaklanan çalışmalar düşük puanlandırılmalıdır.
3. **Temel Monografiler:** Tezin kapsadığı tarihsel dönemi ve vaka alanını doğrudan işleyen kapsayıcı temel monografilere ve saha çalışmalarına ampirik ve tarihsel zemin oluşturdukları için yüksek relevans puanı (80-95+) ver.${quadrantBlock}

# Değerlendirme Kriterleri

- Her makale için başlık, abstract metni ve OpenAlex relevance_score bilgisi verilmiştir.
- Makalenin kutu bağlamına uygunluğunu değerlendir.
- Dönemsel sapma gösteren çalışmalar düşük puanlandırılmalıdır.

# Çıktı Biçimi

Her değerlendirme için aşağıdaki alanları içeren JSON nesneleri dizisi döndürün:
- thesisBoxId: (girdide verilen box id)
- subBoxTitle: (girdide verilen sub box başlığı)
- articleTitle: makale başlığı (aynen)
- isRelevant: boolean
- relevanceScore: 0-100 arası tam sayı
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

Kutu Bağlamı:
- Kutu ID: [Box ${thesisBoxId}]
- Kutu Türü: ${boxType}
- Kutu Başlığı: "${subBoxTitle}"
- Kutu Açıklaması: ${description}

Makaleler:
${articlesText}

# İşlem

Yukarıdaki ${articleCount} makaleyi değerlendir ve her biri için thesisBoxId (${thesisBoxId}), subBoxTitle ("${subBoxTitle}"), articleTitle, isRelevant, relevanceScore (0-100), reasoning (Türkçe) alanlarını içeren JSON dizisi döndür.`;
}
