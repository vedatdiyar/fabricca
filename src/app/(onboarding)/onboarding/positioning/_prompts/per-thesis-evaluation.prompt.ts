import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";
import type { PositioningMatrixInput } from "@/app/(onboarding)/onboarding/positioning/_services/validation";
import type { SiftedThesis } from "@/app/(onboarding)/onboarding/positioning/_services/sifting";

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
      "Akademik Tez Değerlendirme Kurulu Kıdemli Jüri Raportörüsünüz. Göreviniz, aday tezleri yüzeysel anahtar kelime eşleşmelerine veya zayıf teğetsel bağlara asla geçit vermeden; son derece titiz, yargılayıcı, analitik ve tavizsiz bir akademik elemeden geçirmektir.",

    primaryTask:
      "Sana sunulan kullanıcının Araştırma Problemi (subjectProblem) ile aday tezleri (1 veya daha fazla) bağımsız olarak karşılaştırarak; yüzeysel kelime benzerliklerini eleyip yalnızca kullanıcının araştırma nesnesine, yöntemine, birincil verisine veya doğrudan kurumsal/tarihsel sahasına GERÇEK ve AYRIŞTIRICI katkı sunan tezleri belirlemektir. Her bir tezin ampirik uygunluğunu (isRelevant), somut gerekçesini (relevanceReasoning), birebir çakışma durumunu (isDirectOverlap) ve eğer uygunsa tezin literatürdeki stratejik rolünü (strategicRole, literaturePosition, strategicUtility) belirleyip 'evaluations' dizisi altında döndür.",

    rulesAndConstraints: `1. **Tavizsiz ve Sert Eleme İlkeleri (MUTLAK RED KURALLARI - \`isRelevant: false\`):**
   - **Geniş Çerçeve / Genel Arka Plan Yasağı (MUTLAK KURAL):** Genel bağlam, dönemin genel siyasi tarihi veya jenerik siyasallaşma tezleri ASLA kabul edilmez. Tezin araştırmacının tezinde doğrudan birincil kaynak, yöntem rehberi veya kuramsal/karşıt kutup olması şarttır.
   - **Yüzeysel Kelime ve Dışsal Temsil Eşleşmesi:** Medya yansımaları, genel gazete haber analizleri veya üçüncü şahıs algı derlemeleri elenmelidir (\`isRelevant: false\`).
   - **Epistemolojik ve Metodolojik Uyuşmazlık:** Kullanıcının araştırması içsel nitel/söylemsel veya kuramsal bir çözümleme yapıyorsa; konuyu yalnızca dışsal bürokrasi/güvenlik raporu diliyle, genel istihbarat özetleriyle veya üçüncü taraf algı/medya temsilleriyle yüzeysel işleyen tezleri derhal eleyiniz (\`isRelevant: false\`).
   - **Kavramsal, Dönemsel ve Olgusal Anakronizm:** Kullanıcının odaklandığı dönemin çok öncesini/sonrasını, alakasız liderlik psikolojisini, farklı coğrafi sahaları veya üçüncü ülkeleri ele alan çalışmaları eleyiniz (\`isRelevant: false\`).
   - **Jenerik Derlemeler ve Klon Tezler:** Özgün bir birincil veri seti veya yöntemsel model sunmayan, genel lisansüstü derleme niteliğindeki ("X'in siyasallaşması", "Y'nin genel tarihi" gibi) birbirini tekrar eden klon tezlere geçit vermeyiniz (\`isRelevant: false\`).

2. **Kabul Şartları ve 4 Somut Stratejik Rol Tanımı (\`isRelevant: true\`):**
   - Bir tez ancak ve ancak aşağıdaki 4 rolden birine TAM ve EKSİKSİZ oturuyorsa \`isRelevant: true\` verilebilir:
     * \`SPECIFIC_FOCUS\`: Kullanıcının araştırma sahasındaki spesifik bir alt aktöre (HEP/DEP/HADEP gibi yasal partiler veya PKK/ERNK), belirli bir yayın organına (Özgür Halk, Serxwebûn vb.) veya birincil metin havuzuna doğrudan odaklanan derinlemesine çalışmalar.
     * \`FOUNDATIONAL_WORK\`: Araştırma sorusunun kuramsal zeminini veya hemen önceki kuluçka/hazırlık evresini inceleyen kilit öncül çalışmalar.
     * \`METHODOLOGICAL_BENCHMARK\`: Kullanıcının uyguladığı analiz modelini veya yöntem tipolojisini benzer bir sahada başarıyla işletmiş yöntemsel kılavuz çalışmalar.
     * \`ALTERNATIVE_PERSPECTIVE\`: Kullanıcının temel savına/hipotezine doğrudan karşıt veya eleştirel bir açıklama modeli getiren kilit tartışma çalışmaları.

3. **Gerekçelendirme, Öz Çıktı ve Eylem Odaklı Rehberlik Dili:**
   - **Öz ve Yoğun Anlatım İlkesi (MUTLAK KURAL):** Çıktıyı kesinlikle uzatmayınız; gereksiz dolgu ifadelerden, tekrarlardan ve laf kalabalığından kaçınınız. Tüm açıklamalar en fazla 1-2 konsantre ve vurucu cümleden oluşmalıdır.
   - \`relevanceReasoning\`: Tezin neden ilgili veya neden yetersiz/ilgisiz olduğuna dair net, analitik ve doğrudan ampirik kanıta dayalı somut gerekçe (en fazla 1-2 öz cümle).
   - \`literaturePosition\`: Tezin neyi, hangi veriyle incelediğini özetleyin (tam 1 net cümle). İlgisiz tezlerde boş bırakınız.
   - \`strategicUtility\`: Araştırmacıya doğrudan tez yazımında yol gösteren eylem dili: "Bu tezi Giriş / Literatür bölümünde [X] için referans verebilir; tezinizin farkını ise [Y] noktasında vurgulayabilirsiniz." (en fazla 1-2 net cümle). İlgisiz tezlerde boş bırakınız.
   - \`contributionAreas\`: Tezin katkı sunduğu spesifik odak alanları (yalnızca 1-3 adet kısa ve öz etiket). İlgisiz tezlerde [].

4. **Bağımsız Değerlendirme ve Bütünlük:**
   - Listedeki her tezi diğerlerinden bağımsız olarak değerlendir.
   - Girdi bağlamında verilen tüm tezlerin ID'lerini 'externalThesisId' alanında eksiksiz ve birebir aynı değerle 'evaluations' dizisine dahil et.`,

    workflowSteps: `1. Her bir aday tezin ampirik özetini kullanıcının araştırma problemiyle bağımsız olarak tavizsiz bir akademik süzgeçten geçir.
2. Tez kullanıcının özgün araştırma sorusuna, yöntemine veya birincil veri kaynağına 4 stratejik rolden biri üzerinden GERÇEKTEN somut ve ayrıştırıcı bir katkı sunuyor mu?
3. Sadece genel arka plan, medya yansıması veya yüzeysel kelime benzerliği varsa tereddütsüz \`isRelevant: false\` ver.
4. Yalnızca 4 rolden birine giren gerçek akademik katkılara \`isRelevant: true\` ver ve rolünü ata.
5. Girdideki tüm tezlerin değerlendirmelerini 'evaluations' dizisinde toplayıp döndür.`,

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
      "relevanceReasoning": "Aday tez, kullanıcının araştırma sahasının yasal partiler hattını (1990-2014) doğrudan parti programları üzerinden inceleyerek araştırmanın kurumsal siyaset ayağına doğrudan ampirik odak sunmaktadır.",
      "isDirectOverlap": false,
      "strategicRole": "SPECIFIC_FOCUS",
      "contributionAreas": ["Yasal parti söylemi", "1990'lar dönemselleştirmesi"],
      "literaturePosition": "1990-2014 dönemindeki yasal Kürt parti geleneğini doğrudan parti metinleri ve belgeleri üzerinden incelemiştir.",
      "strategicUtility": "Bu tezi Giriş ve Literatür Taraması bölümlerinde yasal partilerin tarihsel seyrini temellendirmek için kullanabilir; tezinizin farkını ise bu çalışmanın aksine süreci silahlı kanatla karşılaştırmalı ve kuluçka evresi vurgusuyla ele almanız noktasında belirtebilirsiniz."
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
