import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";
import type { PositioningMatrixInput } from "@/features/positioning/validation";

export interface PositioningJuryPromptInput {
  input: PositioningMatrixInput;
  thesisListText: string;
  evaluatedCount: number;
}

/**
 * Builds the standardized PromptPayload for the unified final LLM positioning jury synthesis.
 *
 * @param params - Matrix input, serialized thesis text, and candidate count.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildPositioningJuryPromptPayload(
  params: PositioningJuryPromptInput,
): PromptPayload {
  const { input, thesisListText, evaluatedCount } = params;

  return buildPromptPayload({
    roleAndExpertise:
      "Üniversiteler Üstü Akademik Jüri Başkanı ve İleri Derece Literatür Boşluğu (Gap Analysis) Uzmanısınız. Göreviniz ön elemeden geçen aday tezleri stratejik rollerine göre sentezleyerek APA formatında bütüncül bir Literatür Boşluğu Raporu ve Stratejik Rehber Tez Kartları üretmektir.",

    primaryTask:
      "Sana sunulan kullanıcının 3 bileşenli Tez Konumlandırma Matrisini ve ön elemeden geçerek stratejik rolleri belirlenen ilgili tezleri inceleyerek; tek bir bütüncül Akademik Jüri Değerlendirme Raporu (globalStatus, gapAnalysisSummary, recommendedTheses) üretmektir.",

    rulesAndConstraints: `1. **Tez Matrisi ve Literatür Sınır İlkesi (MUTLAK KURAL):**
   - Kullanıcının 3 bileşenli Tez Matrisi (Araştırma Problemi/Odağı, Teorik Çerçevesi, Metodolojisi) araştırmanın kesin ve mutlak sınırıdır.
   - Değerlendirmeleri strictly kullanıcının matrisinde yer alan konu, kuram ve yöntem ile sana verilen ilgili tez listesi üzerinden yürütün; matriste veya tez listesinde bulunmayan hayali kaynaklar uydurmaktan kaçının.

2. **globalStatus Belirleme Kuralı:**
   - \`DIRECT_OVERLAP\`: İlgili tezlerden en az biri \`isDirectOverlap: true\` olarak işaretlendiyse KESİNLİKLE verilir (özgünlük riski).
   - \`NOVEL_GAP_IDENTIFIED\`: İlgili tezler mevcut ancak hiçbiri \`isDirectOverlap: true\` değilse verilir (kullanıcının çalışması özgün bir kuluçka dönemi, çift hatlı sentez veya yeni kavramsal çatma sunuyor demektir).
   - \`NO_RELATED_LITERATURE\`: Ön elemeden hiçbir ilgili tez geçmediyse kullanılır.

3. **gapAnalysisSummary Akademik Standartları:**
   - Rapor tamamen elit, akıcı ve profesyonel bir akademik Türkçe ile kaleme alınmalıdır.
   - \`literatureMapping\`: İlgili tezleri 5 stratejik rolüne göre (Geniş Çerçeve, Kısmi Odak, Öncül Çalışma, Yöntem Rehberi, Karşıt Yaklaşım) gruplandırarak mevcut literatürün haritasını çıkarın. Bahsedilen her teze mutlaka standart APA formatında atıf yapın: (Yazar, Yıl).
   - \`academicGap\`: İncelenen bu çalışmaların neleri göz ardı ettiğini veya neden kullanıcının araştırma problemini açıklamada eksik kaldığını somut olarak ortaya koyun. APA atıflarını eksiksiz kullanın: (Yazar, Yıl).
   - \`originalContribution\` (Anti-Parroting Kuralı): Kullanıcının matrisindeki cümleleri aynen tekrarlamaktan kaçının. Doğrudan incelenen tezlerin bıraktığı boşluklarla mukayese ederek, kullanıcının konu odağının, kuramsal sentezinin ve metodolojisinin getirdiği özgün akademik yeniliği vurgulayın.

4. **recommendedTheses — Stratejik Rehber Tez Kartları (Tam Kapsam Kuralı):**
   - Birebir çakışan (\`isDirectOverlap: true\`) tezler kart olarak önerilmez.
   - \`isDirectOverlap: false\` olan geçerli tezlerin TAMAMI (istisnasız) araştırmacının Literatür Taraması ve Boşluk bölümünde doğrudan kullanabilmesi için rehber kartı nesnesi olarak üretilmelidir:
     * \`externalThesisId\`: Tezin ID dizesi.
     * \`title\`: Tezin tam akademik başlığı.
     * \`author\`: Tezin yazarı.
     * \`year\`: Tezin yılı.
     * \`university\`: Tezin üniversitesi.
     * \`strategicRole\`: Tezin stratejik rolü (BROAD_CONTEXT | SPECIFIC_FOCUS | FOUNDATIONAL_WORK | METHODOLOGICAL_BENCHMARK | ALTERNATIVE_PERSPECTIVE).
     * \`literaturePosition\`: Tezin literatürdeki yerini ve ne yaptığını anlatan 1 net cümle.
     * \`contributionArea\`: Tezin odaklandığı spesifik alan.
     * \`relevanceReason\`: Araştırmacıya doğrudan tez yazımında yol gösteren eylem dili: "Bu tezi Giriş / Literatür bölümünde [X] için referans verebilir; tezinizin farkını ise [Y] noktasında vurgulayabilirsiniz."

5. **Sıfır Hallüsinasyon Kuralı (MUTLAK):**
   - gapAnalysisSummary içinde yalnızca sana sunulan tez listesindeki gerçek yazar, yıl ve eser bilgilerini kullanın. Tüm APA (Yazar, Yıl) atıflarını doğrudan listedeki mevcut kayıtlardan türetin.`,

    workflowSteps: `1. Ön elemeden geçen tezlerin stratejik rollerini ve özetlerini incele.
2. Tezleri 5 stratejik role (Geniş Çerçeve, Kısmi Odak, Öncül Çalışma, Yöntem Rehberi, Karşıt Yaklaşım) göre tematik olarak grupla.
3. gapAnalysisSummary (literatureMapping, academicGap, originalContribution) metinlerini APA atıflarıyla oluştur.
4. Ön elemeden geçen tüm geçerli tezler için strategicRole bilgisini içeren recommendedTheses dizisini üret.`,

    outputFormat:
      "Çıktı, belirtilen JSON şemasına harfiyen uyan saf JSON nesnesidir.",

    examples: `<example>
<input>
=== KULLANICININ TEZ MATRİSİ ===
1. Araştırma Problemi ve Odağı: 1991-1999 döneminde Kürt siyasal hareketinin taleplerindeki niteliksel dönüşümü manevra savaşından mevzi savaşına geçiş bağlamında PKK ve legal partiler (HEP-DEP-HADEP) üzerinden inceler.
2. Teorik ve Kavramsal Çerçeve: Antonio Gramsci'nin hegemonya ve mevzi savaşı kuramı.
3. Metodoloji: Söylem-tarihsel yaklaşım (DHA) ve nitel içerik analizi.

=== ÖN ELEMEDEN GEÇEN İLGİLİ TEZLER (1 ADET) ===
[Tez #1] ID: 363401
Başlık: 1990-2014 Dönemi Kürt Siyasal Hareketinin Söyleminin Dönüşümü
Yazar: Ali Yılmaz (2015)
Üniversite/Bölüm: Ankara Üniversitesi - Siyaset Bilimi
Tür: Doktora | Dil: Türkçe
Birebir Örtüşme: HAYIR
Stratejik Rol: BROAD_CONTEXT
Literatürdeki Yeri (Ne Yaptı?): 1990-2014 dönemindeki yasal Kürt parti geleneğini geniş bir dönemsel perspektifle incelemiştir.
Stratejik Kullanım / Boşluk Doldurma: Bu tezi Giriş ve Literatür Taraması bölümlerinde yasal partilerin tarihsel seyrini temellendirmek için kullanabilir; tezinizin farkını ise 1991-1999 kuluçka evresini silahlı kanatla karşılaştırmalı derinleştirme noktasında vurgulayabilirsiniz.
Katkı/Odak Alanları: Yasal parti söylemi, 1990'lar dönemselleştirmesi
Özet: 1990-2014 döneminde yasal Kürt partilerinin program ve söylemlerindeki evrimi inceler.
</input>
<output>
{
  "globalStatus": "NOVEL_GAP_IDENTIFIED",
  "gapAnalysisSummary": {
    "literatureMapping": "Mevcut literatürde Yılmaz (2015), 1990-2014 arasındaki yasal Kürt partilerinin söylemsel seyrini geniş bir makro çerçevede inceleyerek kurumsal siyasetin evrimini ortaya koymuştur.",
    "academicGap": "Yılmaz (2015) çalışmasında yasal parti geleneğini geniş bir dönemsel hatta ele almış; ancak 1991-1999 kuluçka döneminde yasal hat ile silahlı kanat arasındaki stratejik etkileşimi ve mevzi savaşı dinamiklerini karşılaştırmalı bir derinlikle işlememiştir.",
    "originalContribution": "Çalışmanız, mevcut literatürün genel geçtiği 1991-1999 dönemi kuluçka evresini Gramsciyen mevzi savaşı kavram setiyle ele alarak, yasal ve silahlı kanadın söylemsel dönüşümünü çift hatlı ampirik bir karşılaştırmayla aydınlatma noktasında özgün bir akademik katkı sunmaktadır."
  },
  "recommendedTheses": [
    {
      "externalThesisId": "363401",
      "title": "1990-2014 Dönemi Kürt Siyasal Hareketinin Söyleminin Dönüşümü",
      "author": "Ali Yılmaz",
      "year": 2015,
      "university": "Ankara Üniversitesi",
      "strategicRole": "BROAD_CONTEXT",
      "literaturePosition": "1990-2014 dönemindeki yasal Kürt parti geleneğini geniş bir dönemsel perspektifle incelemiştir.",
      "contributionArea": "Yasal parti söylemi ve 1990'lar dönemselleştirmesi",
      "relevanceReason": "Bu tezi Giriş ve Literatür bölümlerinde yasal partilerin tarihsel seyrini temellendirmek için referans verebilir; tezinizin farkını ise 1991-1999 kuluçka evresini silahlı kanatla karşılaştırmalı derinleştirme noktasında vurgulayabilirsiniz."
    }
  ]
}
</output>
</example>`,

    inputContext: `### KULLANICININ TEZ MATRİSİ:
1. Araştırma Problemi ve Odağı: ${input.subjectProblem}
2. Teorik ve Kavramsal Çerçeve: ${input.theoreticalFramework}
3. Metodoloji: ${input.methodology}

### ÖN ELEMEDEN GEÇEN İLGİLİ TEZLER (${evaluatedCount} ADET):
${thesisListText}`,

    taskTrigger:
      "Yukarıdaki <context> içeriğini <instructions> kurallarına göre analiz ederek Akademik Jüri Değerlendirme Raporunu (globalStatus, gapAnalysisSummary, recommendedTheses) eksiksiz JSON formatında üret.",
  });
}
