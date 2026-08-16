import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";

/**
 * Builds the standardized PromptPayload for extracting dense, noise-free multi-aspect semantic search queries
 * purely from the user's substantive research problem (subjectProblem).
 * Strictly adheres to docs/LLM_INTEGRATION.md (Hybrid XML + Markdown Encapsulation).
 *
 * @param subjectProblem - The substantive empirical research problem text.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildQueryGenerationPromptPayload(
  subjectProblem: string,
): PromptPayload {
  return buildPromptPayload({
    roleAndExpertise:
      "Akademik Literatür Keşfi ve Semantik Arama Uzmanısınız. Göreviniz araştırma probleminden arama motorlarının tam isabetle literatür yakalamasını sağlayan yüksek yoğunluklu semantik sorgular ve olgusal anahtar kavramlar damıtmaktır.",

    primaryTask:
      "Kullanıcının araştırma problemi metnini (subjectProblem) analiz ederek; araştırmanın üzerinde çalıştığı somut ampirik sahayı, aktörleri, kurumları, birincil veri tabanını ve tarihsel/coğrafi dönemi en yüksek hassasiyetle yakalayan 3 tamamlayıcı semantik arama sorgusu ve anahtar kavramlar üretmektir.",

    rulesAndConstraints: `1. **Mutlak Olgusal Saha ve Ampirik Odak (MUTLAK KURAL):**
   - Arama sorguları ve anahtar kavramlar doğrudan araştırmanın incelediği somut olguya, aktörlere, kurumlara, birincil veri kaynaklarına ve tarihsel döneme odaklanmalıdır.
   - Soyut metodolojik kelimeler (örn. "nitel analiz", "içerik analizi", "kodlama şeması") veya genel kuramsal şemsiye terimler (örn. "kuramsal çerçeve", "yapı-özne diyalektiği") KESİNLİKLE arama sorgularına konulmamalıdır.

2. **3 Tamamlayıcı Semantik Arama Açısı:**
   - \`primaryEmpiricalQuery\`: Araştırmanın temel ampirik sorunsalını, dönüşümünü veya olgusunu hedefleyen 20-25 kelimelik yoğun semantik sorgu.
   - \`actorsAndSourcesQuery\`: Araştırmanın incelediği somut aktörleri, kurumları, partileri, örgütleri veya birincil yayın/veri kaynaklarını hedefleyen semantik sorgu.
   - \`periodAndContextQuery\`: Araştırmanın odaklandığı tarihsel dönemi, dönemsel kırılmaları veya somut coğrafi/mekânsal bağlamı hedefleyen semantik sorgu.
   - \`substantiveKeywords\`: Literatür eşleştirmesinde kullanılacak 4-6 adet somut olgusal/aktör/dönem kavramı.

3. **Gürültüsüz ve Yoğun İfade:**
   - Tüm sorgular doğrudan YÖK Tez / Qdrant vektör aramasında en ilgili tezleri getirecek netlikte, doğal akademik dille ve gereksiz bağlaçlardan arındırılmış olmalıdır.`,

    workflowSteps: `1. Kullanıcının araştırma problemindeki ampirik olguyu, aktörleri, kurumları, birincil kaynakları ve dönemi belirle.
2. Bu unsurları 3 tamamlayıcı semantik arama açısına ve somut anahtar kavramlara dönüştür.
3. Çıktıyı JSON şemasına uygun olarak üret.`,

    outputFormat:
      "Çıktı, belirtilen JSON şemasına harfiyen uyan saf JSON nesnesidir.",

    examples: `<example>
<input>
1991-1999 döneminde Kürt siyasal hareketinin taleplerindeki niteliksel dönüşümü manevra ve mevzi savaşı ekseninde PKK ve legal partiler (HEP, DEP, HADEP) üzerinden inceler. Birincil kaynak olarak Serxwebûn dergisi ve TBMM tutanakları kullanılır.
</input>
<output>
{
  "primaryEmpiricalQuery": "Kürt siyasal hareketi taleplerindeki niteliksel dönüşüm yasal partiler ve silahlı kanat söylem değişimi 1990lar",
  "actorsAndSourcesQuery": "HEP DEP HADEP PKK Serxwebûn meclis tutanakları parti programları bildirgeler",
  "periodAndContextQuery": "1991-1999 dönemi Kürt hareketi kuluçka evresi 1999 kırılması yerel seçimler",
  "substantiveKeywords": ["Kürt siyasal hareketi", "HEP-DEP-HADEP", "PKK", "Serxwebûn", "1991-1999 dönemi", "Talep dönüşümü"]
}
</output>
</example>`,

    inputContext: `### Araştırma Problemi ve Olgusal Odak (subjectProblem):
${subjectProblem}`,

    taskTrigger:
      "Yukarıdaki <context> içeriğindeki araştırma problemini analiz ederek <instructions> kurallarına göre `primaryEmpiricalQuery`, `actorsAndSourcesQuery`, `periodAndContextQuery` ve `substantiveKeywords` alanlarını içeren JSON formatında semantik arama sorgusu çıktısını üret.",
  });
}

