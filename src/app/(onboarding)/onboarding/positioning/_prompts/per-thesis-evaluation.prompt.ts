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
Verilen tez konusunu ve sorunsalını baz alarak, aday tezleri **YALNIZCA SOMUT KONUSAL VE OLGUSAL İLİŞKİSİ** açısından değerlendir.

# KATI ELEME KURALLARI (Kesinlikle 'isRelevant: false' Yapılacaklar):
1. **YÖNTEMSEL BENZERLİK TUZAĞI:** Aday tezin kullanıcıyla aynı yöntemi (örn. söylem analizi, anket, derinlemesine mülakat, arşiv taraması) kullanmış olması ASLA tek başına bir ilgililik gerekçesi değildir. Konu ve incelenen somut olgu farklıysa KESİNLİKLE 'isRelevant: false' verilmelidir.
2. **GENİŞ ŞEMSİYE KAVRAM TUZAĞI:** Sırf genel disiplin veya çatı kavramlar (örn. genel "Türkiye siyaseti", "demokratikleşme", "kamu yönetimi", "devlet aklı", "sosyal medya", "modernleşme") ortak diye alakasız araştırmalar 'isRelevant: true' YAPILAMAZ.
3. **FARKLI AKTÖR VEYA FARKLI COĞRAFYA:** Kullanıcının odaklandığı somut aktör, kurum, siyasal hareket veya olgusal bağlam dışındaki çalışmalar (örn. farklı bir ülkedeki hareket veya tamamen farklı bir kamu kurumu) 'isRelevant: false' olarak elenmelidir.
4. **SAF KURAMSAL/FELSEFİ ÇALIŞMALAR:** Kullanıcının kuramsal çerçevesindeki düşünürü (örn. saf Gramsci felsefesi, saf Habermas) ele alan ama kullanıcının somut ampirik alanına temas etmeyen çalışmalar 'isRelevant: false' olarak elenmelidir.

# YALNIZCA ŞU DURUMDA 'isRelevant: true' VERİLİR:
Aday tez doğrudan kullanıcının araştırdığı **SOMUT AMBİRİK NESNEYİ, OLGUSAL SORUNSALI, AKTÖRLERİ VEYA DOĞRUDAN İLGİLİ DÖNEMSEL/SİYASAL GELİŞİMİ** inceliyorsa 'true' kabul edilir.

# Değerlendirme Ölçütleri
1. **isRelevant (Konusal İlgililik):** Aday tez doğrudan kullanıcının araştırdığı somut konuyu, aktörleri veya ampirik olguyu mu inceliyor? (Evet ise true, aksi halde false).
2. **isDirectOverlap (Birebir Çakışma / Özgünlük Riski):** Aday tez kullanıcının araştırdığı soruyu aynı dönem, aynı aktörler ve aynı kapsamda birebir çözmüş ve araştırmacının tezine özgün bir boşluk bırakmamış mıdır? (Evet ise true, aksi halde false).
3. **strategicRole (Konusal Stratejik Rol):** İlgili tezler için aşağıdaki rollerden en uygun olanını seç:
   - **SPECIFIC_FOCUS (Kısmi / Komşu Olgusal Odak):** Konunun belirli bir alt boyutunu (örn. yasal parti kanadı, komşu bir dönemi veya alt bir kurumu) inceleyen çalışma.
   - **FOUNDATIONAL_WORK (Öncül Konu Çalışması):** Konunun tarihsel kökenlerini veya ana gelişim hattını kuran temel konu tezi.
   - **METHODOLOGICAL_BENCHMARK (Paralel Olgusal Analiz):** Aynı ampirik konuyu benzer bir veri setiyle inceleyen doğrudan konusal referans.
   - **ALTERNATIVE_PERSPECTIVE (Karşıt / Farklı Olgusal Yaklaşım):** Aynı konuyu farklı bir siyasal ya da olgusal açıklamayla yorumlayan tartışma kaynağı.
4. **contributionAreas (Katkı / Odak Alanları):** Tezin temas ettiği 1-2 adet somut konu etiketi (örn: "Yasal Kürt Partileri", "1990'lar Söylemsel Dönüşüm").
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
[Kuramsal Çerçeve]: Gramsci manevra/mevzi savaşı, Snow ve Benford çerçeveleme teorisi.
[Yöntem]: Nitel tarihsel söylem analizi.

[Aday Tez #1]:
ID: "101"
Başlık: İdeolojik Hegemonya Sorunsalı ve Gramsci Felsefesi
Yazar: Ali Can (1998)
Özet: Bu çalışmada Gramsci'nin hapishane defterlerindeki hegemonya, mevzi savaşı ve sivil toplum kavramları felsefi olarak incelenmiştir.

[Aday Tez #2]:
ID: "102"
Başlık: Türk Basınında Dış Politika Haberlerinin Söylem Analizi: 1995-2000 Dönemi
Yazar: Selim Kaya (2002)
Özet: Hürriyet ve Sabah gazetelerinde Türkiye'nin AB ile ilişkileri üzerine çıkan köşe yazıları nitel tarihsel söylem analizi yöntemiyle incelenmiştir.

[Aday Tez #3]:
ID: "203"
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
      "relevanceReasoning": "Konu dışı saf felsefi/kuramsal çalışma; kullanıcının ampirik konusu olan Kürt hareketi ve 1990'lar siyasetiyle doğrudan ilişkisi yoktur.",
      "isDirectOverlap": false,
      "strategicRole": "FOUNDATIONAL_WORK",
      "contributionAreas": ["Siyaset Felsefesi"],
      "literaturePosition": "Gramsci'nin hegemonya kavramını felsefi olarak ele almıştır.",
      "strategicUtility": "Genel teori tezi olduğu için konu konumlandırmasında doğrudan kullanılamaz."
    },
    {
      "externalThesisId": "102",
      "isRelevant": false,
      "relevanceReasoning": "Yöntemsel benzerlik tuzağı: Söylem analizi yöntemi kullanılmış olsa da incelenen konu AB dış politikası olup araştırmacının konusuyla tamamen alakasızdır.",
      "isDirectOverlap": false,
      "strategicRole": "METHODOLOGICAL_BENCHMARK",
      "contributionAreas": ["Dış Politika"],
      "literaturePosition": "AB ilişkileri basındaki söylem üzerinden incelenmiştir.",
      "strategicUtility": "Konu dışı olduğu için değerlendirmeye alınmamalıdır."
    },
    {
      "externalThesisId": "203",
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
