import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";
import type { PositioningMatrixInput } from "../validation";

/**
 * Builds the standardized PromptPayload for extracting a dense, noise-free semantic search query
 * from the user's 3-component thesis matrix.
 * Strictly adheres to docs/LLM_INTEGRATION.md (Hybrid XML + Markdown Encapsulation).
 *
 * @param matrix - The 3-component positioning matrix.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildQueryGenerationPromptPayload(
  matrix: PositioningMatrixInput,
): PromptPayload {
  return buildPromptPayload({
    roleAndExpertise:
      "Akademik Tez Arama ve Literatür Keşfi Uzmanısınız. Göreviniz girift tez matrislerinden arama motorlarının tam isabetle literatür yakalamasını sağlayan yüksek yoğunluklu semantik sorgular damıtmaktır.",

    primaryTask:
      "Kullanıcının araştırma problemi, teorik çerçevesi ve metodolojisinden oluşan 3 bileşenli tez matrisini analiz ederek; tezin üzerinde çalıştığı somut tarihsel/olgusal sahayı, aktörleri ve araştırma nesnesini en yüksek hassasiyetle yakalayan yoğun bir semantik arama sorgusu ve anahtar kavramlar üretmektir.",

    rulesAndConstraints: `1. **Olgusal Saha Odaklılık (MUTLAK KURAL):**
   - Arama sorgusu ve anahtar kavramlar doğrudan araştırmanın incelediği somut olguya, siyasal/toplumsal harekete, kurumlara ve tarihsel döneme odaklanmalıdır.
   - Soyut metodolojik kelimeler (örn. "nitel analiz", "kodlama şeması") veya genel şemsiye terimler (örn. "söylem", "temsil") yerine; spesifik aktör, hareket ve dönem adlarını (örn. "Kürt siyasal hareketi 1991-1999 HEP DEP HADEP PKK talep dönüşümü") öne çıkarın.

2. **Gürültüsüz ve Yoğun İfade:**
   - \`primaryQuery\` en fazla 25-30 kelimelik, doğrudan YÖK Tez / Qdrant vektör aramasında en ilgili tezleri getirecek netlikte olmalıdır.
   - \`substantiveKeywords\` en az 3, en fazla 6 adet spesifik olgusal/tarihsel kavramdan oluşmalıdır.`,

    workflowSteps: `1. Kullanıcının araştırma problemini, dönemini ve odaklandığı somut aktörleri belirle.
2. YÖK Tez veritabanındaki benzer tezlerin başlık ve özetlerinde geçecek en kritik olgusal anahtar kelimeleri damıt.
3. Çıktıyı JSON şemasına uygun olarak üret.`,

    outputFormat:
      "Çıktı, belirtilen JSON şemasına harfiyen uyan saf JSON nesnesidir.",

    examples: `<example>
<input>
Araştırma Problemi: 1991-1999 döneminde Kürt siyasal hareketinin taleplerindeki niteliksel dönüşümü manevra savaşından mevzi savaşına geçiş bağlamında PKK ve legal partiler (HEP-DEP-HADEP) üzerinden inceler.
Teorik Çerçeve: Antonio Gramsci'nin hegemonya ve mevzi savaşı kuramı.
Metodoloji: Söylem-tarihsel yaklaşım (DHA) ve nitel içerik analizi.
</input>
<output>
{
  "primaryQuery": "Kürt siyasal hareketi 1991-1999 HEP DEP HADEP PKK söylemsel dönüşüm talep tipolojisi mevzi savaşı",
  "substantiveKeywords": ["Kürt siyasal hareketi", "HEP-DEP-HADEP", "PKK söylemsel dönüşüm", "1991-1999 dönemi", "talep tipolojisi"]
}
</output>
</example>`,

    inputContext: `### 1. Araştırma Problemi ve Odağı:
${matrix.subjectProblem}

### 2. Teorik ve Kavramsal Çerçeve:
${matrix.theoreticalFramework}

### 3. Metodoloji ve Yöntem:
${matrix.methodology}`,

    taskTrigger:
      "Yukarıdaki <context> içeriğindeki 3 bileşenli tez matrisini analiz ederek <instructions> kurallarına göre `primaryQuery` ve `substantiveKeywords` alanlarını içeren JSON formatında semantik arama sorgusu çıktısını üret.",
  });
}
