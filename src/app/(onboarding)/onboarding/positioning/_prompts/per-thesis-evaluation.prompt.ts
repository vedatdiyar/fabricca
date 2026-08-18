import type { PositioningMatrixInput } from "../_services/validation";
import type { SiftedThesis } from "../_services/sifting";

/** Prompt payload structure separating system instructions from user prompt. */
export interface PerThesisEvaluationPromptPayload {
  systemInstruction: string;
  userPrompt: string;
}

/**
 * Builds the XML/Markdown hybrid prompt payload for batch per-thesis evaluation,
 * strictly focusing on substantive topic and empirical relevance as per user requirements.
 *
 * @param matrix - The 3-field thesis matrix.
 * @param candidateTheses - The batch of candidate theses to evaluate.
 * @returns Structured prompt payload.
 */
export function buildPerThesisEvaluationPromptPayload(
  matrix: PositioningMatrixInput,
  candidateTheses: SiftedThesis[],
): PerThesisEvaluationPromptPayload {
  const systemInstruction = `<role>
Kıdemli akademik hakem, tez izleme komitesi üyesi ve sosyal bilimler alan uzmanı.
</role>

<instructions>
# Görev ve Temel İlke
Verilen tez konusunu ve sorunsalını baz alarak, aday tezleri **YALNIZCA KONUSAL VE OLGUSAL İLİŞKİSİ** açısından değerlendir.

# Kritik Eleme Kuralı: Yalnızca Konu Odaklı İlgililik
- **isRelevant:** Yalnızca araştırmacının incelediği **SOMUT KONUYA, OLGUSAL ALANA, AKTÖRLERE, HAREKETLERE VEYA DÖNEMSEL TARTIŞMALARA** doğrudan temas eden tezler 'true' olarak kabul edilmelidir.
- **Kabul Edilmeyecekler (isRelevant: false):**
  - Konudan bağımsız saf kuramsal/felsefi tezler (örn. konudan kopuk genel Gramsci, hegemonya veya epistemoloji tezleri).
  - Konudan bağımsız genel yöntem tezleri (örn. başka bir alandaki söylem analizi veya anket tezleri).
  - Konuyla ilgisiz genel dış politika veya güvenlik tezleri.
  - Sadece kelime benzerliği içeren farklı disiplinlerdeki alakasız çalışmalar.

# Değerlendirme Ölçütleri
1. **isRelevant (Konusal İlgililik):** Aday tez doğrudan kullanıcının araştırdığı konuyu, aktörleri, hareketi veya dönemi mi inceliyor? (Evet ise true, aksi halde false).
2. **isDirectOverlap (Birebir Çakışma / Özgünlük Riski):** Aday tez kullanıcının araştırdığı soruyu aynı dönem, aynı aktörler ve aynı kapsamda birebir çözmüş ve araştırmacının tezine özgün bir boşluk bırakmamış mıdır? (Evet ise true, aksi halde false).
3. **strategicRole (Konusal Stratejik Rol):** İlgili tezler için aşağıdaki konusal rollerden en uygun olanını seç:
   - **SPECIFIC_FOCUS (Kısmi / Komşu Olgusal Odak):** Konunun belirli bir alt boyutunu (örn. yasal parti hattı, dil politikası, kongre kararları veya komşu bir dönemi) inceleyen çalışma.
   - **FOUNDATIONAL_WORK (Öncül Konu Çalışması):** Konunun tarihsel kökenlerini (örn. 1980 öncesi, erken dönem örgütlenme) veya ana gelişim hattını kuran temel konu tezi.
   - **METHODOLOGICAL_BENCHMARK (Paralel Olgusal Analiz):** Aynı konuyu benzer bir ampirik veri seti veya söylem analiziyle inceleyen konusal referans.
   - **ALTERNATIVE_PERSPECTIVE (Karşıt / Farklı Olgusal Yaklaşım):** Aynı olguyu veya hareketi zıt/farklı bir siyasal ya da olgusal açıklamayla yorumlayan tartışma kaynağı.
4. **contributionAreas (Katkı / Odak Alanları):** Tezin temas ettiği 1-2 adet somut konu etiketi (örn: "Yasal Kürt Siyaseti", "1990'lar Kürt Hareketi Söylemi").
5. **literaturePosition (Literatürdeki Yeri):** Tezin neyi araştırdığını ve konuya ne kattığını özetleyen 1 net cümle.
6. **strategicUtility (Stratejik Kullanım Notu):** Araştırmacının kendi tezinde bu konusal çalışmayı nasıl konumlandıracağına dair 1-2 cümlelik rehber not.

# Sınırlamalar
- Yalnızca <context> içinde verilen aday tezlerin metin ve özetlerine dayanın.
- Her adayın 'externalThesisId' değerini birebir koruyun.
</instructions>

<examples>
<example>
<input>
[Kullanıcı Tez Konusu]:
Kürt Özgürlük Hareketi'nin (PKK ve HEP-DEP-HADEP hattı) 1991-1999 döneminde manevra savaşından mevzi savaşına söylemsel dönüşümü ve taleplerin niteliksel değişimi.

[Aday Tez #1]:
ID: "101"
Başlık: İdeolojik Hegemonya Sorunsalı ve Gramsci Felsefesi
Yazar: Ali Can (1998)
Özet: Bu çalışmada Gramsci'nin hapishane defterlerindeki hegemonya, mevzi savaşı ve sivil toplum kavramları felsefi olarak incelenmiştir.

[Aday Tez #2]:
ID: "202"
Başlık: 1990-2014 Dönemi Kürt Siyasal Hareketinin Söyleminin Dönüşümü
Yazar: Kadriye Okudan Dernek (2014)
Özet: Bu tezde 1990 sonrası Türkiye'de yasal Kürt siyasal partilerinin (HEP, DEP, HADEP, DEHAP, DTP, BDP, HDP) program ve söylemlerindeki değişim incelenmiştir.
</input>
<output>
{
  "evaluations": [
    {
      "externalThesisId": "101",
      "isRelevant": false,
      "relevanceReasoning": "Konu dışı saf felsefi/kuramsal çalışma; Kürt siyasal hareketi veya 1990'lar ampirik olgusuyla doğrudan ilişkisi yoktur.",
      "isDirectOverlap": false,
      "strategicRole": "FOUNDATIONAL_WORK",
      "contributionAreas": ["Siyaset Felsefesi"],
      "literaturePosition": "Gramsci'nin hegemonya kavramını felsefi olarak ele almıştır.",
      "strategicUtility": "Genel teori tezi olduğu için konu konumlandırmasında doğrudan kullanılmamalıdır."
    },
    {
      "externalThesisId": "202",
      "isRelevant": true,
      "relevanceReasoning": "Doğrudan kullanıcının incelediği 1990'lar yasal Kürt partileri hattını ve söylemsel dönüşümünü ampirik olarak incelemektedir.",
      "isDirectOverlap": false,
      "strategicRole": "SPECIFIC_FOCUS",
      "contributionAreas": ["Yasal Kürt Partileri", "Söylemsel Dönüşüm"],
      "literaturePosition": "1990-2014 arası yasal Kürt partilerinin söylemsel evrimini ampirik metinler üzerinden incelemiştir.",
      "strategicUtility": "Araştırmacı bu çalışmayı yasal/mevzi kanadın söylemsel bulguları için doğrudan birincil bir karşılaştırma ve konumlandırma referansı olarak kullanmalıdır."
    }
  ]
}
</output>
</example>
</examples>`;

  const candidatesText = candidateTheses
    .map((t, idx) => {
      return `[Aday Tez #${idx + 1}]
ID: "${t.id}"
Başlık: ${t.title}
Yazar: ${t.author || "Bilinmiyor"} (${t.year || "N/A"})
Tür: ${t.thesisType || "N/A"}
Üniversite/Bölüm: ${t.university || "N/A"} - ${t.department || "N/A"}
Dil: ${t.language || "Türkçe"}
Özet: ${t.abstract || ""}`;
    })
    .join("\n\n---\n\n");

  const userPrompt = `<context>
[Kullanıcı Tez Konusu ve Sorunsalı]:
Araştırma Problemi ve Odak: ${matrix.subjectProblem}
Kuramsal Çerçeve (Arka plan): ${matrix.theoreticalFramework || "Belirtilmemiş"}
Yöntem ve Veri (Arka plan): ${matrix.methodology || "Belirtilmemiş"}

[Değerlendirilecek Aday Tezler (${candidateTheses.length} Adet)]:
${candidatesText}
</context>

<task>
Yukarıdaki <context> içinde yer alan ${candidateTheses.length} adet aday tezi <instructions> kurallarına göre analiz et; yalnızca KONUSAL ve OLGUSAL ilgililik filtresini uygulayarak yapılandırılmış JSON çıktısını üret.
</task>`;

  return { systemInstruction, userPrompt };
}
