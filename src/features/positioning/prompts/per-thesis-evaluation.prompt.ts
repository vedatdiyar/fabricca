import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";
import type { PositioningMatrixInput } from "@/features/positioning/validation";
import type { SiftedThesis } from "@/features/positioning/sifting";

/**
 * Builds the standardized PromptPayload for single-thesis strategic evaluation.
 * Strictly adheres to docs/LLM_INTEGRATION.md (Hybrid XML + Markdown Encapsulation).
 *
 * @param input - The validated positioning matrix input containing subjectProblem.
 * @param thesis - The candidate thesis to evaluate.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildPerThesisEvaluationPromptPayload(
  input: PositioningMatrixInput | { subjectProblem: string },
  thesis: SiftedThesis,
): PromptPayload {
  return buildPromptPayload({
    roleAndExpertise:
      "Akademik Tez Değerlendirme Kurulu Kıdemli Raportörüsünüz. Göreviniz aday tezin ampirik araştırma nesnesini, kullanıcının araştırma problemiyle tarafsız, titiz ve ilkeli bir biçimde karşılaştırarak stratejik ön eleme yapmaktır.",

    primaryTask:
      "Sana sunulan kullanıcının Araştırma Problemi (subjectProblem) ile adaya ait TEK BİR tezi karşılaştırarak; tezin ampirik uygunluğunu (isRelevant), gerekçesini (relevanceReasoning), birebir çakışma durumunu (isDirectOverlap) ve eğer uygunsa tezin literatürdeki stratejik rolünü (strategicRole, literaturePosition, strategicUtility) belirlemektir.",

    rulesAndConstraints: `1. **Parçalı Stratejik Rol İlkesi (MUTLAK KURAL):**
   - Literatürdeki yardımcı tezlerin kullanıcının tüm araştırma boyutlarını tek başına kapsamasını beklemek metodolojik bir hatadır (zaten tüm boyutları birebir kapsarsa özgünlük riski / çakışma oluşur).
   - Aday tez; kullanıcının araştırma probleminin, sahasının veya odaklandığı nesnenin **EN AZ BİR SOMUT BOYUTUNU** (belirli bir aktör grubunu, birincil veri kaynağını, kurumsal yapısını veya tarihsel dönemini) ampirik olarak inceliyorsa \`isRelevant: true\` verilir:
     * Konuyu daha geniş bir tarihsel/makro çerçevede ele alan çalışmalar -> \`BROAD_CONTEXT\`
     * Araştırmanın tek bir boyutuna, aktörüne veya birincil kaynağına odaklanan çalışmalar -> \`SPECIFIC_FOCUS\`
     * Konunun önceki evrelerini, tarihsel köklerini veya zeminini inceleyen çalışmalar -> \`FOUNDATIONAL_WORK\`
     * Benzer bir ampirik veri toplama veya analiz modeli uygulayan çalışmalar -> \`METHODOLOGICAL_BENCHMARK\`
     * Karşıt veya farklı bir açıklama modeli sunan çalışmalar -> \`ALTERNATIVE_PERSPECTIVE\`

2. **Kesin Eleme Sebepleri (\`isRelevant: false\`):**
   - Araştırılan hareketin/konunun iç dinamikleri yerine; tamamen dışsal bağlamları (üçüncü ülkelerin dış politikasını, doğrudan bağı olmayan dış yapıları veya sadece medyanın dışsal temsillerini) inceleyen tezler.
   - Somut birincil/ampirik veriye dayanmayan, yalnızca genel/ikincil kaynaklar üzerinden soyut kavramları tartışan genel literatür derlemeleri.
   - Kullanıcının araştırma problemiyle hiçbir ampirik, kurumsal veya olgusal kesişimi bulunmayan farklı konular.

3. **Gerekçelendirme ve Eylem Odaklı Rehberlik Dili:**
   - \`relevanceReasoning\`: Tezin neden ilgili veya ilgisiz olduğuna dair somut ampirik kanıt ve mantıksal gerekçe (1-2 net cümle).
   - \`literaturePosition\`: Tezin başlık ve özetine dayanarak neyi, hangi veriyle incelediğini özetleyin (1 cümle).
   - \`strategicUtility\`: Araştırmacıya doğrudan tez yazımında yol gösteren eylem dili kullanın: "Bu tezi Giriş / Literatür bölümünde [X] için referans verebilir; tezinizin farkını ise [Y] noktasında vurgulayabilirsiniz."`,

    workflowSteps: `1. Aday tezin somut ampirik araştırma nesnesini kullanıcının araştırma problemiyle karşılaştır.
2. Tez kullanıcının araştırma sahasının en az bir boyutuna doğrudan ampirik katkı sunuyor mu?
3. Uygunsa \`isRelevant: true\` ver ve 5 stratejik rolden birini ata. Tamamen dışsal veya alakasız ise \`isRelevant: false\` ver.`,

    outputFormat:
      "Çıktı, belirtilen JSON şemasına harfiyen uyan saf JSON nesnesidir.",

    examples: `<example>
<input>
=== KULLANICININ ARAŞTIRMA PROBLEMİ (subjectProblem) ===
1991-1999 döneminde Kürt Özgürlük Hareketi'nin söylemsel dönüşümünü manevra ve mevzi savaşı bağlamında PKK ve HEP-DEP-HADEP partiler hattı üzerinden inceler.

=== DEĞERLENDİRİLECEK TEZ ===
Tez ID: 363401
Başlık: 1990-2014 Dönemi Kürt Siyasal Hareketinin Söyleminin Dönüşümü
Yazar: Kadriye Okudan Dernek (2014)
Özet: 1990-2014 döneminde yasal Kürt partilerinin (HEP, DEP, HADEP, DEHAP, DTP, BDP, HDP) program ve söylemlerindeki evrimi inceler.
</input>
<output>
{
  "externalThesisId": "363401",
  "isRelevant": true,
  "relevanceReasoning": "Aday tez, kullanıcının araştırma sahasının yasal partiler hattını (1990-2014) geniş bir perspektifle inceleyerek araştırmanın kurumsal siyaset ayağına doğrudan ampirik zemin sunmaktadır.",
  "isDirectOverlap": false,
  "strategicRole": "BROAD_CONTEXT",
  "contributionAreas": ["Yasal parti söylemi", "1990'lar dönemselleştirmesi"],
  "literaturePosition": "1990-2014 dönemindeki yasal Kürt parti geleneğini geniş bir dönemsel perspektifle incelemiştir.",
  "strategicUtility": "Bu tezi Giriş ve Literatür Taraması bölümlerinde yasal partilerin tarihsel seyrini temellendirmek için kullanabilir; tezinizin farkını ise bu çalışmanın yüzeysel geçtiği 1991-1999 kuluçka evresini silahlı kanatla karşılaştırmalı olarak derinleştirme noktasında vurgulayabilirsiniz."
}
</output>
</example>

<example>
<input>
=== KULLANICININ ARAŞTIRMA PROBLEMİ (subjectProblem) ===
1991-1999 döneminde Kürt Özgürlük Hareketi'nin söylemsel dönüşümünü inceler.

=== DEĞERLENDİRİLECEK TEZ ===
Tez ID: 447567
Başlık: Kürt Siyasal Hareketinde İslami Bir Aktör: Irak Kürdistan İslami Birlik Partisi
Yazar: Lokman Karadağ (2016)
Özet: Irak Kürdistan bölgesindeki İslami Birlik Partisi'nin siyasal katılımını inceler.
</input>
<output>
{
  "externalThesisId": "447567",
  "isRelevant": false,
  "relevanceReasoning": "Aday tez Türkiye'deki Kürt siyasal hareketini değil, Irak'taki bölgesel partileri incelemektedir; ampirik kesişimi bulunmamaktadır.",
  "isDirectOverlap": false,
  "contributionAreas": [],
  "literaturePosition": "",
  "strategicUtility": ""
}
</output>
</example>`,

    inputContext: `### KULLANICININ ARAŞTIRMA PROBLEMİ (subjectProblem):
${input.subjectProblem}

### DEĞERLENDİRİLECEK TEZ:
Tez ID: ${thesis.id}
Başlık: ${thesis.title}
Yazar: ${thesis.author || "Bilinmiyor"} (${thesis.year || "N/A"})
Üniversite/Bölüm: ${thesis.university || "N/A"} - ${thesis.department || "N/A"}
Tür: ${thesis.thesisType || "N/A"} | Dil: ${thesis.language || "N/A"}
Özet: ${thesis.abstract}`,

    taskTrigger:
      "Yukarıdaki <context> içinde yer alan tezi <instructions> kurallarına göre analiz ederek JSON formatında değerlendirme çıktısını üret.",
  });
}

/**
 * Builds the standardized PromptPayload for multi-thesis batch strategic evaluation.
 * Strictly adheres to docs/LLM_INTEGRATION.md (Hybrid XML + Markdown Encapsulation).
 *
 * @param input - The validated positioning matrix input containing subjectProblem.
 * @param theses - Candidate theses in the batch.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildBatchPerThesisEvaluationPromptPayload(
  input: PositioningMatrixInput | { subjectProblem: string },
  theses: SiftedThesis[],
): PromptPayload {
  const formattedTheses = theses
    .map(
      (t) => `Tez ID: ${t.id}
Başlık: ${t.title}
Yazar: ${t.author || "Bilinmiyor"} (${t.year || "N/A"})
Üniversite/Bölüm: ${t.university || "N/A"} - ${t.department || "N/A"}
Tür: ${t.thesisType || "N/A"} | Dil: ${t.language || "N/A"}
Özet: ${t.abstract}`,
    )
    .join("\n\n---\n\n");

  return buildPromptPayload({
    roleAndExpertise:
      "Akademik Tez Değerlendirme Kurulu Kıdemli Raportörüsünüz. Göreviniz listedeki aday tezleri kullanıcının araştırma problemiyle olgusal ve ampirik açıdan karşılaştırarak tarafsız ve ilkeli bir stratejik ön eleme yapmaktır.",

    primaryTask:
      "Sana sunulan kullanıcının Araştırma Problemi (subjectProblem) ile listedeki HER BİR TEZİ TEK TEK karşılaştırarak; tezin olgusal uygunluğunu (isRelevant), gerekçesini (relevanceReasoning), birebir çakışma durumunu (isDirectOverlap) ve eğer uygunsa tezin literatürdeki stratejik rolünü (strategicRole, literaturePosition, strategicUtility) belirleyip `evaluations` dizisi olarak döndürmektir.",

    rulesAndConstraints: `1. **Parçalı Stratejik Rol İlkesi (MUTLAK KURAL):**
   - Aday tez; kullanıcının araştırma probleminin, sahasının veya odaklandığı nesnenin **EN AZ BİR SOMUT BOYUTUNU** (belirli bir aktör grubunu, birincil veri kaynağını, kurumsal yapısını veya tarihsel dönemini) ampirik olarak inceliyorsa \`isRelevant: true\` verilir.
   - Stratejik roller: \`BROAD_CONTEXT\` (Geniş Çerçeve), \`SPECIFIC_FOCUS\` (Kısmi Odak), \`FOUNDATIONAL_WORK\` (Öncül Çalışma), \`METHODOLOGICAL_BENCHMARK\` (Yöntem Rehberi), \`ALTERNATIVE_PERSPECTIVE\` (Karşıt Yaklaşım).

2. **Kesin Eleme Sebepleri (\`isRelevant: false\`):**
   - Araştırılan konunun kendi iç dinamikleri yerine tamamen dışsal bağlamları (üçüncü ülkelerin dış politikasını veya sadece medyanın dışsal temsillerini) inceleyen tezler.
   - Somut birincil/ampirik veriye dayanmayan genel ikincil literatür derlemeleri.
   - Araştırma problemiyle ampirik kesişimi olmayan alakasız konular.`,

    workflowSteps: `1. Her tezin somut ampirik araştırma nesnesini kullanıcının araştırma problemiyle karşılaştır.
2. Araştırmanın en az bir boyutuna ampirik katkı sunan tezlere isRelevant: true ver ve strategicRole ata.
3. Alakasız veya dışsal tezleri ele (isRelevant: false).`,

    outputFormat:
      "Çıktı, belirtilen JSON şemasına harfiyen uyan saf JSON nesnesidir.",

    examples: `<example>
<input>
=== KULLANICININ ARAŞTIRMA PROBLEMİ (subjectProblem) ===
1991-1999 döneminde Kürt Özgürlük Hareketi'nin söylemsel dönüşümünü inceler.

=== DEĞERLENDİRİLECEK TEZLER ===
Tez ID: 363401
Başlık: 1990-2014 Dönemi Kürt Siyasal Hareketinin Söyleminin Dönüşümü
Yazar: Kadriye Okudan Dernek (2014)
Özet: 1990-2014 döneminde yasal Kürt partilerinin program ve söylemlerini inceler.
</input>
<output>
{
  "evaluations": [
    {
      "externalThesisId": "363401",
      "isRelevant": true,
      "relevanceReasoning": "Yasal parti söylemi geleneğini (1990-2014) geniş bir perspektifle ele alarak araştırmanın kurumsal ayağına ampirik temel sunmaktadır.",
      "isDirectOverlap": false,
      "strategicRole": "BROAD_CONTEXT",
      "contributionAreas": ["Yasal parti söylemi", "1990'lar dönemselleştirmesi"],
      "literaturePosition": "1990-2014 dönemindeki yasal Kürt parti geleneğini geniş bir dönemsel perspektifle incelemiştir.",
      "strategicUtility": "Giriş ve Literatür bölümlerinde tarihsel seyri temellendirmek için kullanılabilir."
    }
  ]
}
</output>
</example>`,

    inputContext: `### KULLANICININ ARAŞTIRMA PROBLEMİ (subjectProblem):
${input.subjectProblem}

### DEĞERLENDİRİLECEK TEZLER:
${formattedTheses}`,

    taskTrigger:
      "Yukarıdaki <context> içinde yer alan her bir tezi <instructions> kurallarına göre değerlendirerek `evaluations` dizisi içeren JSON formatında çıktı üret.",
  });
}

