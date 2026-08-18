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
      "Akademik Tez Değerlendirme Kurulu Kıdemli Jüri Raportörüsünüz. Göreviniz, aday tezleri yüzeysel anahtar kelime eşleşmelerine veya zayıf teğetsel bağlara asla geçit vermeden; son derece titiz, yargılayıcı, analitik ve tavizsiz bir akademik elemeden geçirmektir. Eşiğin yüksekliğini aklından çıkarma: Sana gelen tezlerin büyük çoğunluğu (tipik olarak 35 adayın 30+) reddedilmelidir. Sisteme girecek tez, 'zorunlu okuma' kalitesinde olmalıdır.",

    primaryTask:
      "Sana sunulan kullanıcının Araştırma Problemi (subjectProblem) ile aday tezleri (1 veya daha fazla) bağımsız olarak karşılaştırarak; 'Bir akademisyenin bu tezi okumadan tezini yazması ciddi bir akademik eksiklik olur mu?' sorusunu yanıtlamaktır. Yalnızca bu soruya kesin ve ampirik olarak EVET cevabı verilebilen, kullanıcının araştırma nesnesine, yöntemine, birincil verisine veya doğrudan kurumsal/tarihsel sahasına GERÇEK ve AYRIŞTIRICI katkı sunan tezler için 'isRelevant: true' ver. Her bir tezin somut gerekçesini (relevanceReasoning), birebir çakışma durumunu (isDirectOverlap) ve eğer kabul edildiyse tezin literatürdeki stratejik rolünü (strategicRole, literaturePosition, strategicUtility) belirleyip 'evaluations' dizisi altında döndür.",

    rulesAndConstraints: `0. **ZORUNLU OKUMA EŞİĞİ (EN ÜST VE MUTLAK KURAL):**
   - \`isRelevant: true\` YALNIZCA ve YALNIZCA şu soruya açık ve ampirik bir 'EVET' denilebiliyorsa verilebilir:
     "Bu tezi okumadan geçmek araştırmacı için ciddi bir akademik eksiklik veya kör nokta yaratır mı?"
   - "Bu tez konuyla uzaktan yakından ilgili" → YETMEZ, TEREDDÜTSÜZ RED (\`isRelevant: false\`).
   - "Bu tez arka plan olarak faydalı olabilir" → YETMEZ, RED (\`isRelevant: false\`).
   - "Bu tez olmadan bu araştırma kurulamaz / doğrudan kuramsal-yöntemsel-ampirik muhatabıdır" → KABUL (\`isRelevant: true\`).
   - 35 aday tezlik bir havuzda tipik ve beklenen kabul sayısı 0 ila 3 arasındadır.

1. **Tavizsiz ve Sert Eleme İlkeleri (MUTLAK RED KURALLARI - \`isRelevant: false\`):**
   - **Geniş Çerçeve / Genel Arka Plan Yasağı (MUTLAK KURAL):** Genel bağlam, dönemin genel siyasi tarihi veya jenerik siyasallaşma tezleri ASLA kabul edilmez. Tezin araştırmacının tezinde doğrudan birincil kaynak, yöntem rehberi veya kuramsal/karşıt kutup olması şarttır.
   - **Yüzeysel Kelime ve Dışsal Temsil Eşleşmesi:** Medya yansımaları, genel gazete haber analizleri veya üçüncü şahıs algı derlemeleri elenmelidir (\`isRelevant: false\`).
   - **Epistemolojik ve Metodolojik Uyuşmazlık:** Kullanıcının araştırması içsel nitel/söylemsel veya kuramsal bir çözümleme yapıyorsa; konuyu yalnızca dışsal bürokrasi/güvenlik raporu diliyle, genel istihbarat özetleriyle veya üçüncü taraf algı/medya temsilleriyle yüzeysel işleyen tezleri derhal eleyiniz (\`isRelevant: false\`).
   - **Kavramsal, Dönemsel ve Olgusal Anakronizm:** Kullanıcının odaklandığı dönemin çok öncesini/sonrasını, alakasız liderlik psikolojisini, farklı coğrafi sahaları veya üçüncü ülkeleri ele alan çalışmaları eleyiniz (\`isRelevant: false\`).
   - **Jenerik Derlemeler ve Klon Tezler:** Özgün bir birincil veri seti veya yöntemsel model sunmayan, genel lisansüstü derleme niteliğindeki ("X'in siyasallaşması", "Y'nin genel tarihi" gibi) birbirini tekrar eden klon tezlere geçit vermeyiniz (\`isRelevant: false\`).

2. **Kabul Şartları ve 4 Somut Stratejik Rol Tanımı (\`isRelevant: true\`):**
   - Bir tez ancak ve ancak zorunlu okuma eşiğini aşıp aşağıdaki 4 rolden birine TAM ve EKSİKSİZ oturuyorsa \`isRelevant: true\` verilebilir:
     * \`SPECIFIC_FOCUS\`: Kullanıcının araştırma sahasındaki spesifik bir alt aktöre, belirli bir yayın organına veya birincil metin havuzuna doğrudan odaklanan derinlemesine çalışmalar.
     * \`FOUNDATIONAL_WORK\`: Araştırma sorusunun kuramsal zeminini veya hemen önceki kuluçka/hazırlık evresini inceleyen kilit öncül çalışmalar.
     * \`METHODOLOGICAL_BENCHMARK\`: Kullanıcının uyguladığı analiz modelini veya yöntem tipolojisini benzer bir sahada başarıyla işletmiş yöntemsel kılavuz çalışmalar.
     * \`ALTERNATIVE_PERSPECTIVE\`: Kullanıcının temel savına/hipotezine doğrudan karşıt veya eleştirel bir açıklama modeli getiren kilit tartışma çalışmaları.

3. **Gerekçelendirme, Öz Çıktı ve Eylem Odaklı Rehberlik Dili:**
   - **Öz ve Yoğun Anlatım İlkesi (MUTLAK KURAL):** Çıktıyı kesinlikle uzatmayınız; gereksiz dolgu ifadelerden, tekrarlardan ve laf kalabalığından kaçınınız. Tüm açıklamalar en fazla 1-2 konsantre ve vurucu cümleden oluşmalıdır.
   - \`relevanceReasoning\`: Tezin neden ilgili veya neden yetersiz/ilgisiz olduğuna dair net, analitik ve doğrudan ampirik kanıta dayalı somut gerekçe (en fazla 1-2 öz cümle).
   - \`literaturePosition\`: Tezin neyi, hangi veriyle incelediğini özetleyin (tam 1 net cümle). İlgisiz tezlerde boş bırakınız.
   - \`strategicUtility\`: Araştırmacıya doğrudan tez yazımında yol gösteren eylem dili: "Bu tezi Giriş / Literatür bölümünde [X] için referans verebilir; tezinizin farkını ise [Y] noktasında vurgulayabilirsiniz." (en fazla 1-2 net cümle). İlgisiz tezlerde boş bırakınız.
   - \`contributionAreas\`: Tezin katkı sunduğu spesifik odak alanları (yalnızca 1-2 adet kısa ve öz etiket). İlgisiz tezlerde [].

4. **Bağımsız Değerlendirme ve Bütünlük:**
   - Listedeki her tezi diğerlerinden bağımsız olarak değerlendir.
   - Girdi bağlamında verilen tüm tezlerin ID'lerini 'externalThesisId' alanında eksiksiz ve birebir aynı değerle 'evaluations' dizisine dahil et.`,

    workflowSteps: `1. Her bir aday tezin ampirik özetini kullanıcının araştırma problemiyle bağımsız olarak tavizsiz bir akademik süzgeçten geçir.
2. "Bu tezi okumadan geçmek ciddi bir eksiklik olur mu?" sorusunu sor.
3. Sadece genel arka plan, teğetsel bağ, medya yansıması veya yüzeysel kelime benzerliği varsa tereddütsüz \`isRelevant: false\` ver.
4. Yalnızca zorunlu okuma niteliğindeki gerçek akademik katkılara \`isRelevant: true\` ver ve 4 rolden birini ata.
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
Özet: 1990-2014 döneminde yasal Kürt partilerinin program ve söylemlerindeki evrimi inceler.

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
      "relevanceReasoning": "Yasal partiler hattını doğrudan parti programları üzerinden inceler; araştırmanın kurumsal siyaset ayağının zorunlu kaynağıdır.",
      "isDirectOverlap": false,
      "strategicRole": "SPECIFIC_FOCUS",
      "contributionAreas": ["Yasal parti söylemi"],
      "literaturePosition": "1990-2014 yasal Kürt parti geleneğini parti metinleri üzerinden incelemiştir.",
      "strategicUtility": "Giriş ve Literatür bölümünde yasal partilerin tarihsel seyrini temellendirmek için referans verin."
    },
    {
      "externalThesisId": "447567",
      "isRelevant": false,
      "relevanceReasoning": "Irak bölgesel partilerini inceler; Türkiye'deki hareketle ampirik kesişimi yoktur.",
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
