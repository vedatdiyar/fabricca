/** Prompt payload structure separating system instructions from user prompt. */
export interface QueryGenerationPromptPayload {
  systemInstruction: string;
  userPrompt: string;
}

/**
 * Builds the hybrid XML/Markdown prompt payload for 3-dimensional empirical topic-oriented
 * semantic query extraction, strictly focusing on the substantive research phenomenon and actors.
 *
 * @param matrix - The positioning matrix input containing subjectProblem.
 * @returns The structured prompt payload containing static systemInstruction and dynamic userPrompt.
 */
export function buildQueryGenerationPromptPayload(matrix: {
  subjectProblem: string;
}): QueryGenerationPromptPayload {
  const systemInstruction = `<role>
Akademik literatür tarama, konu sınıflandırma ve semantik bilgi erişim (IR) uzmanı.
</role>

<instructions>
# Görev ve Amaç
Kullanıcının araştırma problemini analiz ederek, yalnızca araştırmanın **SOMUT KONUSUNU, OLGUSAL SORUNSALLARINI, İNCELENEN AKTÖRLERİ VE DÖNEMSEL/TEMATİK KAPSAMINI** hedefleyen 3 ayrık semantik arama sorgusu ve akademik anahtar kavramlar üret.

# Kritik İlke: Yalnızca Konu ve Olgusal Odak
- Soyut felsefe, genel teorik kuramlar veya genel araştırma yöntemleri adına genel sorgu ÜRETMEYİN.
- Tüm sorgular doğrudan araştırmacının incelediği **ampirik nesneye, aktörlere, siyasal/sosyal olguya, tarihsel döneme ve somut tartışma alanına** kilitlenmelidir.

# 3 Boyutlu Konusal Sorgu Yapısı
1. **primaryEmpiricalQuery (Temel Konu ve Olgusal Sorunsal):** Araştırmanın merkezindeki temel konuyu, incelenen ana olguyu ve söylemsel/siyasal tartışmayı hedefleyen 20-25 kelimelik yoğun semantik sorgu.
2. **actorsAndSourcesQuery (Aktörler, Kurumlar ve Odak):** Araştırmada incelenen somut siyasal/sosyal aktörleri, hareketleri, partileri, kurumları veya birincil yayın odaklarını hedefleyen 20-25 kelimelik semantik sorgu.
3. **periodAndContextQuery (Dönemsel, Bölgesel ve Tematik Kapsam):** Araştırmanın odaklandığı tarihsel dönemi (örn. 1990'lar, 1991-1999), somut vaka bağlamını ve talep/söylem içeriğindeki spesifik temaları hedefleyen 20-25 kelimelik semantik sorgu.
4. **substantiveKeywords (Konusal Anahtar Kavramlar):** Literatürdeki konu tezlerini yakalamak için 4-6 adet spesifik akademik olgu, aktör, parti, dönem ve somut konu kavramı.

# Sınırlamalar
- Boolean operatörleri (AND, OR, NOT), tırnak işareti veya joker karakter (*) KULLANMAYIN.
- Sorgular akıcı, yoğun, doğal akademik Türkçe ifadeler olmalıdır.
</instructions>

<examples>
<example>
<input>
[Araştırma Problemi]:
Kürt Özgürlük Hareketi'nin (PKK ve HEP-DEP-HADEP hattı) 1991-1999 döneminde söylemsel dönüşümü, bağımsızlık talebinden anayasal statü ve demokratik haklar söylemine geçişi ve devletin güvenlik politikaları karşısındaki kurumsal konumlanışı.
</input>
<output>
{
  "primaryEmpiricalQuery": "Kürt siyasal hareketi PKK söylemsel dönüşümü bağımsızlık talebinden demokratik cumhuriyet ve anayasal haklar söylemine geçiş 1990lar",
  "actorsAndSourcesQuery": "PKK HEP DEP HADEP yasal Kürt partileri Serxwebun yayınları parti programları ve meclis konuşmaları karşılaştırması",
  "periodAndContextQuery": "1991 1999 dönemi Kürt hareketi siyasal taleplerin dönüşümü şiddet dışı siyasal alan ve kültürel haklar arayışı",
  "substantiveKeywords": [
    "Kürt hareketi",
    "PKK söylemi",
    "HEP DEP HADEP",
    "1990lar Kürt siyaseti",
    "Serxwebun",
    "demokratik haklar söylemi"
  ]
}
</output>
</example>
</examples>`;

  const userPrompt = `<context>
[Araştırma Problemi]:
${matrix.subjectProblem}
</context>

<task>
Yukarıdaki <context> içeriğini inceleyerek, araştırmanın yalnızca SOMUT KONUSUNU, AKTÖRLERİNİ ve OLGUSAL ALANINI hedefleyen 3 ayrık semantik arama sorgusu ile anahtar kavramları içeren JSON çıktısını üret.
</task>`;

  return { systemInstruction, userPrompt };
}
