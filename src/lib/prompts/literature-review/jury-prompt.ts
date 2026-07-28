/**
 * Builds the box-type-specific instruction block embedded in the system instruction.
 *
 * SUBJECT_PROBLEM boxes receive a dynamic warning derived from thesisSubject,
 * box title, and box description — requiring case-specific works and rejecting
 * general theories unrelated to the thesis context.
 *
 * THEORETICAL_FRAMEWORK / METHODOLOGY boxes prioritise respected handbooks
 * and foundational texts, filtering narrow case studies.
 */
function buildBoxTypeInstruction(
  boxType: string,
  subBoxTitle: string,
  description: string,
  thesisSubject: string,
): string {
  const isSubjectProblem = boxType === "SUBJECT_PROBLEM";

  return isSubjectProblem
    ? `⚠️ ÖNEMLİ — VAKA KUTUSU (SUBJECT_PROBLEM):
Bu kutu TEZİN SPESİFİK VAKASINI analiz eden bir VAKA KUTUSUDUR.
Tez Konusu: "${thesisSubject}" | Kutu Bağlamı: "${subBoxTitle}" - ${description}.
Makalelerin MUTLAKA yukarıda belirtilen tez konusunun ve kutu bağlamının spesifik aktörlerini, tarihsel/coğrafi bağlamını ve vakasını işlemesi ŞARTTIR.
Genel/jenerik teorileri veya başka ülke/toplumsal hareket vakalarını öne çıkaran makaleler bu kutu için ALAKASIZDIR ve elenmelidir.`
    : `- **THEORETICAL_FRAMEWORK / METHODOLOGY türündeki kutular için:** Makalenin bizzat tezin spesifik vakasını işlemesi zorunlu değildir. Ancak bu kutularda alanın literatürde kabul görmüş üst düzey, saygın, metodolojik/teorik el kitapları ve kurucu metinleri önceliklendirilmeli; tezin vaka analiziyle ilişkilendirilemeyecek marjinal, dar kapsamlı spesifik vaka incelemeleri (örneğin alakasız toplumsal hareketler) elenmelidir.`;
}

/**
 * Builds the system instruction for the single-box jury LLM call.
 *
 * @param boxType - Box type (SUBJECT_PROBLEM, THEORETICAL_FRAMEWORK, METHODOLOGY)
 * @param subBoxTitle - Sub-box title
 * @param description - Box description
 * @param thesisBoxId - Box database ID
 * @param thesisSubject - The thesis subject problem text (ana tez konusu)
 * @returns Formatted system instruction string
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

  return `# Rol ve Uzmanlık

Sen, OpenAlex'ten dönen akademik makaleleri belirli bir tez alt kutusu bağlamında değerlendiren uzman bir akademik jüri üyesisin.

# Birincil Görev

Her bir makaleyi, içinde bulunduğu alt kutunun türü, başlığı ve açıklaması ile karşılaştırarak değerlendir. Makalenin kutu bağlamıyla doğrudan alakalı olup olmadığına karar ver, 0-100 arası gerçek alaka skoru belirle, kurucu eser (foundational work) olup olmadığını işaretle ve 1 cümlelik Türkçe gerekçe yaz.

# Kutu Türü ve Değerlendirme Kuralı

Bu kutu türü: **${boxType}**
Kutu Başlığı: ${subBoxTitle}
Kutu Açıklaması: ${description}

${boxTypeInstruction}

# Değerlendirme Kriterleri

- Her makale için başlık, abstract metni ve OpenAlex relevance_score bilgisi verilmiştir.
- Makalenin kutu bağlamına uygunluğunu değerlendir.
- Sadece gerçekten kurucu metinler için isFoundational=true kullan.

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
 * @param thesisSubject - The thesis subject problem text
 * @param thesisBoxId - Box database ID
 * @param subBoxTitle - Sub-box title
 * @param boxType - Box type
 * @param description - Box description
 * @param articlesText - Serialized article list (title, authors, abstract, relevance_score)
 * @param articleCount - Number of articles being evaluated
 * @returns Formatted user prompt string
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
