import type { PositioningMatrixInput } from "../_services/validation";

/** Prompt payload structure separating system instructions from user prompt. */
export interface JuryAnalysisPromptPayload {
  systemInstruction: string;
  userPrompt: string;
}

/**
 * Builds the hybrid XML/Markdown prompt payload for the final jury synthesis analysis,
 * strictly focusing on the empirical research topic, actors, and subject-matter literature gap.
 *
 * @param params - Parameters containing the validated matrix, formatted evaluated theses text, and count.
 * @returns Structured prompt payload.
 */
export function buildPositioningJuryPromptPayload(params: {
  input: PositioningMatrixInput;
  thesisListText: string;
  evaluatedCount: number;
}): JuryAnalysisPromptPayload {
  const { input, thesisListText, evaluatedCount } = params;

  const systemInstruction = `<role>
Akademik jüri başkanı, tez izleme komitesi raportörü ve alan uzmanı.
</role>

<instructions>
# Görev ve Sentez Amacı
Kullanıcının sunduğu tez konusunu/sorunsalını ve ilgili bulunan **KONUSAL ve OLGUSAL TEZLERİ** inceleyerek; çalışmanın konu literatüründeki özgünlük durumunu karara bağla, 3 boyutlu derin bir Konusal Boşluk Analizi Raporu sentezle ve en stratejik 4-8 adet konu kılavuz tezinin ID'lerini seç.

# Jüri Değerlendirme Kuralları
1. **globalStatus (Jüri Genel Kararı):**
   - **NOVEL_GAP_IDENTIFIED (Özgün Katkı / Boşluk Mevcut):** Literatürde aynı konuyu/hareketi inceleyen çalışmalar var ancak araştırmacının dönemi, aktör ayrımı veya konu sorunsalı belirgin ve özgün bir olgusal boşluğu dolduruyor.
   - **DIRECT_OVERLAP (Birebir Çakışma / Özgünlük Riski):** İncelenen tezlerden biri kullanıcının araştırma konusunu, aynı dönemi ve aynı aktörleri aynı kapsamda daha önce birebir çalışmış.
   - **NO_RELATED_LITERATURE (Bakir Alan / Doğrudan Konu Tezi Yok):** Veritabanında doğrudan aynı konuyu veya aktörleri inceleyen tez bulunamadı.

2. **gapAnalysisSummary (3 Boyutlu Konusal Boşluk Analizi Raporu):**
   - **literatureMapping (Mevcut Konu Literatürünün Haritalandırılması):** Mevcut konu tezlerinin hangi aktörler, hangi dönemler ve hangi temalar üzerinde yoğunlaştığının akademik analizi (Markdown).
   - **academicGap (Konudaki Olgusal / Dönemsel Boşluk):** Mevcut çalışmaların neleri ele almadığı, hangi dönem veya aktör dinamiklerini açıkta bıraktığının analizi (Markdown).
   - **originalContribution (Çalışmanın Özgün Konusal Katkısı):** Araştırmacının tezinin bu olgusal/dönemsel boşluğu nasıl dolduracağının analizi (Markdown).

3. **selectedThesisIds (Kılavuz Konu Tezlerinin Seçimi):**
   - İncelenen ilgili tezler arasından araştırmacıya doğrudan konusal referans sunacak en stratejik 4 ila 8 adet tezin ID'sini seç.

# Sınırlamalar
- Yalnızca araştırmanın somut konusuna, aktörlerine ve ampirik alanına odaklanın. Konu dışı soyut teori veya genel yöntem tartışmalarına girmeyin.
- Metinlerde akıcı, yetkin ve saygın bir akademik Türkçe kullanın.
</instructions>

<examples>
<example>
<input>
[Kullanıcı Tez Konusu]:
Kürt Özgürlük Hareketi'nin 1991-1999 döneminde söylemsel dönüşümü; PKK ve HEP-DEP-HADEP hattının taleplerindeki değişim ve kuluçka evresi.

[İncelenen İlgili Tezler]:
[Tez #1] ID: "201" | Başlık: 1990-2014 Dönemi Kürt Siyasal Hareketinin Söyleminin Dönüşümü | Rol: SPECIFIC_FOCUS
[Tez #2] ID: "302" | Başlık: Türkiye'de Kürt Etno-Bölgesel Hareketi (1959-1984) | Rol: FOUNDATIONAL_WORK
[Tez #3] ID: "403" | Başlık: PKK'nın Kürtçe ve Kültürel Haklar Politikası (1990'lar) | Rol: SPECIFIC_FOCUS
</input>
<output>
{
  "globalStatus": "NOVEL_GAP_IDENTIFIED",
  "gapAnalysisSummary": {
    "literatureMapping": "Türkiye'de Kürt hareketi üzerine yapılan mevcut tezler; 1980 öncesi tarihsel kökenler (Alış, 2017) ve 1990 sonrası yasal siyasi partilerin genel söylem evrimi (Okudan Dernek, 2014) ekseninde yoğunlaşmaktadır. Literatürde yasal partilerin parlamenter söylemleri ile silahlı kanadın yayın organlarındaki dönüşüm dinamikleri çoğunlukla birbirinden yalıtılmış olarak ele alınmıştır.",
    "academicGap": "Mevcut konu literatürü, 1999 sonrasındaki söylemsel değişimi ani bir kırılma olarak görme eğilimindedir. 1991-1999 arası kuluçka dönemi; silahlı kanat (PKK) ile yasal parti hattının (HEP-DEP-HADEP) talep içeriklerindeki niteliksel dönüşüm ve bu iki aktör arasındaki söylemsel etkileşim açısından derinlemesine incelenmemiştir.",
    "originalContribution": "Bu çalışma, 1991-1999 dönemini iki ayrı aktör hattının (silahlı ve yasal) talep tipolojisi üzerinden bağımsız olarak inceleyip karşılaştırarak, 1999 dönüşümünün tarihsel ve söylemsel kuluçka evresini ortaya koymakta ve konu literatüründeki önemli bir dönemsel ve olgusal boşluğu doldurmaktadır."
  },
  "selectedThesisIds": ["201", "302", "403"]
}
</output>
</example>
</examples>`;

  const userPrompt = `<context>
[Kullanıcı Tez Konusu ve Sorunsalı]:
Araştırma Problemi ve Odak: ${input.subjectProblem}
Kuramsal Çerçeve: ${input.theoreticalFramework || "Belirtilmemiş"}
Yöntem ve Veri: ${input.methodology || "Belirtilmemiş"}

[İncelenen İlgili Konu Tezleri (${evaluatedCount} Adet)]:
${thesisListText}
</context>

<task>
Yukarıdaki <context> içeriğindeki ${evaluatedCount} adet konu tezini ve kullanıcı konusunu <instructions> kurallarına göre analiz et; jüri durum kararını, 3 boyutlu konusal boşluk analizi raporunu ve kılavuz tez ID listesini içeren JSON çıktısını üret.
</task>`;

  return { systemInstruction, userPrompt };
}
