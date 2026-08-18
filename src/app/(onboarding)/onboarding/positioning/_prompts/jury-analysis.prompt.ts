import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";
import type { PositioningMatrixInput } from "@/app/(onboarding)/onboarding/positioning/_services/validation";

export interface PositioningJuryPromptInput {
  input: PositioningMatrixInput;
  thesisListText: string;
  evaluatedCount: number;
}

/**
 * Builds the standardized PromptPayload for the unified final LLM positioning
 * jury synthesis. The LLM only produces the global status and the gap analysis
 * synthesis; the recommended guiding thesis cards are assembled deterministically
 * in TypeScript and are NOT part of the LLM output contract.
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
      "Üniversiteler Üstü Akademik Jüri Başkanı ve İleri Derece Literatür Boşluğu (Gap Analysis) Uzmanısınız. Göreviniz zorunlu okuma eşiğini aşarak ön elemeden geçen kilit tezleri stratejik rollerine göre sentezleyerek APA formatında bütüncül bir Literatür Boşluğu Raporu üretmektir.",

    primaryTask:
      "Sana sunulan kullanıcının 3 bileşenli Tez Konumlandırma Matrisini ve zorunlu okuma eşiğini aşarak stratejik rolleri belirlenen temel tezleri inceleyerek; tek bir bütüncül Akademik Jüri Değerlendirme Sentezi (globalStatus ve gapAnalysisSummary) üretmektir. Zorunlu okuma tez kartları (recommendedTheses) sistem tarafından ayrıca ve deterministik olarak oluşturulur; sen bunları üretmezsin.",

    rulesAndConstraints: `1. **Tez Matrisi ve Literatür Sınır İlkesi (MUTLAK KURAL):**
   - Kullanıcının 3 bileşenli Tez Matrisi (Araştırma Problemi/Odağı, Teorik Çerçevesi, Metodolojisi) araştırmanın kesin ve mutlak sınırıdır.
   - Değerlendirmeleri strictly kullanıcının matrisinde yer alan konu, kuram ve yöntem ile sana verilen ilgili tez listesi üzerinden yürütün; matriste veya tez listesinde bulunmayan hayali kaynaklar uydurmaktan kaçının.

2. **globalStatus Belirleme Kuralı:**
   - \`DIRECT_OVERLAP\`: İlgili tezlerden en az biri \`Birebir Örtüşme: EVET\` olarak işaretlendiyse KESİNLİKLE verilir (özgünlük riski).
   - \`NOVEL_GAP_IDENTIFIED\`: İlgili tezler mevcut ancak hiçbiri \`Birebir Örtüşme: EVET\` değilse verilir (kullanıcının çalışması özgün bir kuluçka dönemi, çift hatlı sentez veya yeni kavramsal çatma sunuyor demektir).
   - \`NO_RELATED_LITERATURE\`: Ön elemeden hiçbir ilgili tez geçmediyse kullanılır.

3. **gapAnalysisSummary Akademik Standartları:**
   - Rapor tamamen elit, akıcı ve profesyonel bir akademik Türkçe ile kaleme alınmalıdır.
   - \`literatureMapping\`: Zorunlu okuma eşiğini geçen kilit tezleri 4 stratejik rolüne göre (Kısmi Odak, Öncül Çalışma, Yöntem Rehberi, Karşıt Yaklaşım) gruplandırarak mevcut literatürün haritasını çıkarın. Bahsedilen her teze mutlaka standart APA formatında atıf yapın: (Yazar, Yıl).
   - \`academicGap\`: İncelenen bu çalışmaların neleri göz ardı ettiğini veya neden kullanıcının araştırma problemini açıklamada eksik kaldığını somut olarak ortaya koyun. APA atıflarını eksiksiz kullanın: (Yazar, Yıl).
   - \`originalContribution\` (Anti-Parroting Kuralı): Kullanıcının matrisindeki cümleleri aynen tekrarlamaktan kaçının. Doğrudan incelenen tezlerin bıraktığı boşluklarla mukayese ederek, kullanıcının konu odağının, kuramsal sentezinin ve metodolojisinin getirdiği özgün akademik yeniliği vurgulayın.

4. **Sıfır Hallüsinasyon Kuralı (MUTLAK):**
   - gapAnalysisSummary içinde yalnızca sana sunulan tez listesindeki gerçek yazar, yıl ve eser bilgilerini kullanın. Tüm APA (Yazar, Yıl) atıflarını doğrudan listedeki mevcut kayıtlardan türetin.`,

    workflowSteps: `1. Ön elemeden geçen tezlerin stratejik rollerini ve künyelerini incele.
2. Tezleri 4 stratejik role (Kısmi Odak, Öncül Çalışma, Yöntem Rehberi, Karşıt Yaklaşım) göre tematik olarak grupla.
3. gapAnalysisSummary (literatureMapping, academicGap, originalContribution) metinlerini APA atıflarıyla oluştur.
4. globalStatus kuralına göre tek bir değer belirle.`,

    outputFormat:
      "Çıktı, yalnızca globalStatus ve gapAnalysisSummary alanlarını içeren belirtilen JSON şemasına harfiyen uyan saf JSON nesnesidir. recommendedTheses üretilmez.",

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
Stratejik Rol: SPECIFIC_FOCUS
Literatürdeki Yeri (Ne Yaptı?): 1990-2014 dönemindeki yasal Kürt parti geleneğini geniş bir dönemsel perspektifle incelemiştir.
Stratejik Kullanım / Boşluk Doldurma: Bu tezi Giriş ve Literatür Taraması bölümlerinde yasal partilerin tarihsel seyrini temellendirmek için kullanabilir; tezinizin farkını ise 1991-1999 kuluçka evresini silahlı kanatla karşılaştırmalı derinleştirme noktasında vurgulayabilirsiniz.
Katkı/Odak Alanları: Yasal parti söylemi, 1990'lar dönemselleştirmesi
</input>
<output>
{
  "globalStatus": "NOVEL_GAP_IDENTIFIED",
  "gapAnalysisSummary": {
    "literatureMapping": "Mevcut literatürde Yılmaz (2015), 1990-2014 arasındaki yasal Kürt partilerinin söylemsel seyrini geniş bir makro çerçevede inceleyerek kurumsal siyasetin evrimini ortaya koymuştur.",
    "academicGap": "Yılmaz (2015) çalışmasında yasal parti geleneğini geniş bir dönemsel hatta ele almış; ancak 1991-1999 kuluçka döneminde yasal hat ile silahlı kanat arasındaki stratejik etkileşimi ve mevzi savaşı dinamiklerini karşılaştırmalı bir derinlikle işlememiştir.",
    "originalContribution": "Çalışmanız, mevcut literatürün genel geçtiği 1991-1999 dönemi kuluçka evresini Gramsciyen mevzi savaşı kavram setiyle ele alarak, yasal ve silahlı kanadın söylemsel dönüşümünü çift hatlı ampirik bir karşılaştırmayla aydınlatma noktasında özgün bir akademik katkı sunmaktadır."
  }
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
      "Yukarıdaki <context> içeriğini <instructions> kurallarına göre analiz ederek Akademik Jüri Değerlendirme Sentezini (globalStatus, gapAnalysisSummary) eksiksiz JSON formatında üret.",
  });
}
