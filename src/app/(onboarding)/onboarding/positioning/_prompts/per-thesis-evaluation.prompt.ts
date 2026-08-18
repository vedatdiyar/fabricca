import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";
import type { PositioningMatrixInput } from "@/app/(onboarding)/onboarding/positioning/_services/validation";
import type { SiftedThesis } from "@/app/(onboarding)/onboarding/positioning/_services/sifting";

/**
 * Builds the standardized PromptPayload for Stage 2: Deep Strategic Profiling of pre-screened relevant theses.
 * Strictly adheres to docs/LLM_INTEGRATION.md (Hybrid XML + Markdown Encapsulation).
 *
 * @param input - The validated positioning matrix input.
 * @param thesesInput - One or more pre-screened relevant theses to profile.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildPerThesisEvaluationPromptPayload(
  input: PositioningMatrixInput | { subjectProblem: string; theoreticalFramework?: string; methodology?: string },
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

  const subjectProblem = input.subjectProblem || "";
  const theoreticalFramework = ("theoreticalFramework" in input && input.theoreticalFramework) ? input.theoreticalFramework : "Belirtilmemiş";
  const methodology = ("methodology" in input && input.methodology) ? input.methodology : "Belirtilmemiş";

  return buildPromptPayload({
    roleAndExpertise:
      "Üniversiteler Üstü Akademik Jüri Kıdemli Metodoloji Raportörüsünüz. Göreviniz, ön elemeden başarıyla geçmiş temel rehber tezlerin stratejik rollerini, literatürdeki konumlarını ve araştırmacının tez yazımında nasıl kullanılacaklarını derinlemesine yapılandırmaktır.",

    primaryTask:
      "Sana sunulan kullanıcının 3 bileşenli Tez Matrisi (Araştırma Problemi, Teorik Çerçevesi, Metodolojisi) ile ön elemeden geçmiş kilit tezleri inceleyerek; her bir tezin stratejik rolünü (strategicRole), literatür konumunu (literaturePosition), stratejik kullanım rehberini (strategicUtility), katkı alanlarını (contributionAreas) ve birebir çakışma durumunu (isDirectOverlap) belirleyip 'evaluations' dizisi altında döndür.",

    rulesAndConstraints: `1. **4 Somut Stratejik Rol Tanımı:**
   - \`SPECIFIC_FOCUS\`: Kullanıcının araştırma sahasındaki spesifik bir alt aktöre, kuruma, belirli bir yayın organına veya birincil metin havuzuna doğrudan odaklanan derinlemesine çalışmalar.
   - \`FOUNDATIONAL_WORK\`: Araştırma sorusunun kuramsal zeminini veya incelenen dönemin hemen önceki kuluçka/hazırlık evresini inceleyen kilit öncül çalışmalar.
   - \`METHODOLOGICAL_BENCHMARK\`: Kullanıcının uyguladığı analiz modelini veya yöntem tipolojisini benzer bir sahada başarıyla işletmiş yöntemsel kılavuz çalışmalar.
   - \`ALTERNATIVE_PERSPECTIVE\`: Kullanıcının temel savına/hipotezine doğrudan karşıt veya eleştirel bir açıklama modeli getiren kilit tartışma çalışmaları.

2. **Birebir Çakışma Tespiti (\`isDirectOverlap\`):**
   - Yalnızca ve yalnızca incelenen tezin Araştırma Odağı + Kuramsal Çerçevesi + Veri Seti kullanıcının teziyle **BİREBİR AYNI** ise (kullanıcının çalışmasında özgünlük riski varsa) \`isDirectOverlap: true\` verilir.
   - Konu benzer olsa da farklı bir dönem, kuram veya yöntem işletiliyorsa kesinlikle \`isDirectOverlap: false\` verilir.

3. **Öz, Yoğun ve Eylem Odaklı Rehberlik Dili:**
   - \`literaturePosition\`: Tezin neyi, hangi veriyle incelediğini özetleyin (tam 1 net cümle, maks 120 karakter).
   - \`strategicUtility\`: Araştırmacıya doğrudan tez yazımında yol gösteren eylem dili: "Bu tezi Giriş / Literatür bölümünde [X] için referans verebilir; tezinizin farkını ise [Y] noktasında vurgulayabilirsiniz." (1-2 konsantre cümle, maks 180 karakter).
   - \`contributionAreas\`: Tezin katkı sunduğu spesifik odak alanları (yalnızca 1-2 adet kısa ve öz etiket).

4. **Bütünlük:**
   - Girdi bağlamında verilen tüm tezlerin ID'lerini 'externalThesisId' alanında eksiksiz ve birebir aynı değerle 'evaluations' dizisine dahil et.`,

    workflowSteps: `1. Her bir tezin özetini kullanıcının araştırma problemi, teorik çerçevesi ve metodolojisiyle karşılaştır.
2. Teze en uygun stratejik rolü (SPECIFIC_FOCUS, FOUNDATIONAL_WORK, METHODOLOGICAL_BENCHMARK, ALTERNATIVE_PERSPECTIVE) ata.
3. Birebir örtüşme (isDirectOverlap) kontrolü yap.
4. literaturePosition ve eylem odaklı strategicUtility notunu yaz.
5. Tüm profilleri 'evaluations' dizisinde toplayıp döndür.`,

    outputFormat:
      "Çıktı, 'evaluations' dizisi içeren belirtilen JSON şemasına harfiyen uyan saf JSON nesnesidir.",

    examples: `<example>
<input>
=== KULLANICININ TEZ MATRİSİ ===
1. Araştırma Problemi: 1980 Sonrası Türkiye'de İktisadi Dönüşüm ve İş Dünyası Örgütlerinin Söylemi (TÜSİAD ve MÜSİAD Karşılaştırması).
2. Teorik Çerçeve: Eleştirel Ekonomi Politik ve Hegemonya Kuramı.
3. Metodoloji: Nitel Söylem Analizi.

=== PROFİLLENECEK TEZ ===
--- TEZ #1 ---
Tez ID: 101
Başlık: 1980-2000 Döneminde TÜSİAD ve MÜSİAD'ın İktisadi Söyleminin Evrimi
Yazar: Ahmet Kaya (2018)
Üniversite/Bölüm: Ankara Üniversitesi - İktisat
Özet: İki iş örgütünün yayınladığı resmi raporlar ve genel kurul bildirileri üzerinden sermaye fraksiyonlarının söylemsel dönüşümünü inceler.
</input>
<output>
{
  "evaluations": [
    {
      "externalThesisId": "101",
      "isRelevant": true,
      "isDirectOverlap": false,
      "strategicRole": "SPECIFIC_FOCUS",
      "contributionAreas": ["İş örgütleri söylemi", "Sermaye fraksiyonları"],
      "literaturePosition": "1980-2000 döneminde TÜSİAD ve MÜSİAD resmi raporlarını eleştirel söylem analiziyle incelemiştir.",
      "strategicUtility": "Giriş ve Literatür bölümünde iş örgütlerinin tarihsel söylem ayrışmasını temellendirmek için referans verebilir; tezinizin farkını Gramsciyen hegemonya ekseninde vurgulayabilirsiniz."
    }
  ]
}
</output>
</example>`,

    inputContext: `### KULLANICININ TEZ MATRİSİ:
1. Araştırma Problemi ve Odağı: ${subjectProblem}
2. Teorik ve Kavramsal Çerçeve: ${theoreticalFramework}
3. Metodoloji: ${methodology}

### PROFİLLENECEK KİLİT TEZLER (${theses.length} ADET):
${candidateThesesContext}`,

    taskTrigger:
      "Yukarıdaki <context> içinde yer alan kilit tezlerin her birini <instructions> kurallarına göre analiz ederek 'evaluations' dizisi altında JSON formatında profilleme çıktılarını üret.",
  });
}
