import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";
import type { PositioningMatrixInput } from "@/features/positioning/validation";
import type { SiftedThesis } from "@/features/positioning/sifting";

/**
 * Builds the standardized PromptPayload for batch or single-thesis strategic evaluation.
 * Strictly adheres to docs/LLM_INTEGRATION.md (Hybrid XML + Markdown Encapsulation).
 *
 * @param input - The validated positioning matrix input containing subjectProblem.
 * @param thesesInput - One or more candidate theses to evaluate in batch.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildPerThesisEvaluationPromptPayload(
  input: PositioningMatrixInput | { subjectProblem: string },
  thesesInput: SiftedThesis[] | SiftedThesis,
): PromptPayload {
  const theses = Array.isArray(thesesInput) ? thesesInput : [thesesInput];

  const candidateThesesContext = theses
    .map(
      (thesis, idx) => `--- TEZ #${idx + 1} ---
Tez ID: ${thesis.id}
Başlık: ${thesis.title}
Yazar: ${thesis.author || "Bilinmiyor"} (${thesis.year || "N/A"})
Üniversite/Bölüm: ${thesis.university || "N/A"} - ${thesis.department || "N/A"}
Tür: ${thesis.thesisType || "N/A"} | Dil: ${thesis.language || "N/A"}
Özet: ${thesis.abstract}`,
    )
    .join("\n\n");

  return buildPromptPayload({
    roleAndExpertise:
      "Akademik Tez Değerlendirme Kurulu Kıdemli Raportörüsünüz. Göreviniz aday tezlerin ampirik araştırma nesnesini, kullanıcının araştırma problemiyle tarafsız, titiz ve ilkeli bir biçimde karşılaştırarak stratejik ön eleme yapmaktır.",

    primaryTask:
      "Sana sunulan kullanıcının Araştırma Problemi (subjectProblem) ile aday tezleri (1 veya daha fazla) bağımsız olarak karşılaştırarak; her bir tezin ampirik uygunluğunu (isRelevant), gerekçesini (relevanceReasoning), birebir çakışma durumunu (isDirectOverlap) ve eğer uygunsa tezin literatürdeki stratejik rolünü (strategicRole, literaturePosition, strategicUtility) belirleyip 'evaluations' dizisi altında döndürmektir.",

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
   - \`strategicUtility\`: Araştırmacıya doğrudan tez yazımında yol gösteren eylem dili kullanın: "Bu tezi Giriş / Literatür bölümünde [X] için referans verebilir; tezinizin farkını ise [Y] noktasında vurgulayabilirsiniz."

4. **Bağımsız Değerlendirme ve Bütünlük:**
   - Listedeki her tezi diğerlerinden bağımsız olarak değerlendir.
   - Girdi bağlamında verilen tüm tezlerin ID'lerini 'externalThesisId' alanında eksiksiz ve birebir aynı değerle 'evaluations' dizisine dahil et.`,

    workflowSteps: `1. Her bir aday tezin somut ampirik araştırma nesnesini kullanıcının araştırma problemiyle bağımsız olarak karşılaştır.
2. Tez kullanıcının araştırma sahasının en az bir boyutuna doğrudan ampirik katkı sunuyor mu?
3. Uygunsa \`isRelevant: true\` ver ve 5 stratejik rolden birini ata. Tamamen dışsal veya alakasız ise \`isRelevant: false\` ver.
4. Girdideki tüm tezlerin değerlendirmelerini 'evaluations' dizisinde toplayıp döndür.`,

    outputFormat:
      "Çıktı, 'evaluations' dizisi içeren belirtilen JSON şemasına harfiyen uyan saf JSON nesnesidir.",

    examples: `<example>
<input>
=== KULLANICININ ARAŞTIRMA PROBLEMİ (subjectProblem) ===
1991-1999 döneminde Kürt Özgürlük Hareketi'nin söylemsel dönüşümünü manevra ve mevzi savaşı bağlamında PKK ve HEP-DEP-HADEP partiler hattı üzerinden inceler.

=== DEĞERLENDİRİLECEK ADAY TEZLER ===
--- TEZ #1 ---
Tez ID: 363401
Başlık: 1990-2014 Dönemi Kürt Siyasal Hareketinin Söyleminin Dönüşümü
Yazar: Kadriye Okudan Dernek (2014)
Özet: 1990-2014 döneminde yasal Kürt partilerinin (HEP, DEP, HADEP, DEHAP, DTP, BDP, HDP) program ve söylemlerindeki evrimi inceler.

--- TEZ #2 ---
Tez ID: 447567
Başlık: Kürt Siyasal Hareketinde İslami Bir Aktör: Irak Kürdistan İslami Birlik Partisi
Yazar: Lokman Karadağ (2016)
Özet: Irak Kürdistan bölgesindeki İslami Birlik Partisi'nin siyasal katılımını inceler.
</input>
<output>
{
  "evaluations": [
    {
      "externalThesisId": "363401",
      "isRelevant": true,
      "relevanceReasoning": "Aday tez, kullanıcının araştırma sahasının yasal partiler hattını (1990-2014) geniş bir perspektifle inceleyerek araştırmanın kurumsal siyaset ayağına doğrudan ampirik zemin sunmaktadır.",
      "isDirectOverlap": false,
      "strategicRole": "BROAD_CONTEXT",
      "contributionAreas": ["Yasal parti söylemi", "1990'lar dönemselleştirmesi"],
      "literaturePosition": "1990-2014 dönemindeki yasal Kürt parti geleneğini geniş bir dönemsel perspektifle incelemiştir.",
      "strategicUtility": "Bu tezi Giriş ve Literatür Taraması bölümlerinde yasal partilerin tarihsel seyrini temellendirmek için kullanabilir; tezinizin farkını ise bu çalışmanın yüzeysel geçtiği 1991-1999 kuluçka evresini silahlı kanatla karşılaştırmalı olarak derinleştirme noktasında vurgulayabilirsiniz."
    },
    {
      "externalThesisId": "447567",
      "isRelevant": false,
      "relevanceReasoning": "Aday tez Türkiye'deki Kürt siyasal hareketini değil, Irak'taki bölgesel partileri incelemektedir; ampirik kesişimi bulunmamaktadır.",
      "isDirectOverlap": false,
      "contributionAreas": [],
      "literaturePosition": "",
      "strategicUtility": ""
    }
  ]
}
</output>
</example>`,

    inputContext: `### KULLANICININ ARAŞTIRMA PROBLEMİ (subjectProblem):
${input.subjectProblem}

### DEĞERLENDİRİLECEK ADAY TEZLER:
${candidateThesesContext}`,

    taskTrigger:
      "Yukarıdaki <context> içinde yer alan aday tezlerin her birini <instructions> kurallarına göre bağımsız olarak analiz ederek 'evaluations' dizisi altında JSON formatında değerlendirme çıktılarını üret.",
  });
}
