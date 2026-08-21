import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";
import type { JsonSchema } from "@/core/services/ai";

export interface CitationSynthesisPromptInput {
  cards: Array<{
    id: number;
    content: string;
    sourceTitle: string;
    authors?: string[];
    year?: number | null;
    pageNumber: string;
    noteType: string;
    outlineId?: number | null;
  }>;
  outlines: Array<{
    id: number;
    title: string;
    description?: string | null;
  }>;
  targetOutlineId?: number;
}

export const citationSynthesisJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    clusters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          themeTitle: {
            type: "string",
            description: "Tematik fikir kümesi başlığı (Türkçe).",
          },
          description: {
            type: "string",
            description: "Kümenin anlamsal özeti ve tezdeki rolü.",
          },
          cardIds: {
            type: "array",
            items: { type: "number" },
            description: "Bu kümeye ait alıntı fişi ID listesi.",
          },
          suggestedOutlineId: {
            type: "number",
            description: "Bu kümenin atanması önerilen Outline bölüm ID'si.",
          },
          suggestedOutlineTitle: {
            type: "string",
            description: "Önerilen bölüm başlığı.",
          },
        },
        required: ["id", "themeTitle", "description", "cardIds"],
        additionalProperties: false,
      },
    },
    argumentFlow: {
      type: "array",
      items: {
        type: "object",
        properties: {
          step: { type: "number" },
          cardId: { type: "number" },
          roleInArgument: {
            type: "string",
            description:
              "Argümandaki işlevi (örn: 'Tez Giriş İddiası', 'Karşı Argüman / Şerh', 'Ampirik Kanıt', 'Sentez & Çözüm').",
          },
          transitionNote: {
            type: "string",
            description:
              "Word'de yazarken önceki adımdan bu adıma geçişi sağlayacak bağlaç/kavramsal köprü önerisi.",
          },
        },
        required: ["step", "cardId", "roleInArgument", "transitionNote"],
        additionalProperties: false,
      },
    },
  },
  required: ["clusters", "argumentFlow"],
  additionalProperties: false,
};

/**
 * Builds prompt payload for Citation Synthesis & Argument Flow Ordering.
 */
export function buildCitationSynthesisPromptPayload(
  params: CitationSynthesisPromptInput,
): PromptPayload {
  const { cards, outlines, targetOutlineId } = params;

  const targetOutline = outlines.find((o) => o.id === targetOutlineId);

  const formattedCards = cards
    .map((c) => {
      const authors = c.authors?.join(", ") || "Bilinmiyor";
      const year = c.year ? ` (${c.year})` : "";
      const outlineInfo = c.outlineId
        ? `[Bölüm ID: ${c.outlineId}]`
        : "[EŞLENMEMİŞ]";
      return `ID: ${c.id} | ${outlineInfo} | ${c.sourceTitle}${year} - s. ${c.pageNumber} (${authors})\nTür: ${c.noteType}\nİçerik: ${c.content}`;
    })
    .join("\n\n");

  const formattedOutlines = outlines
    .map(
      (o) =>
        `Bölüm ID ${o.id}: ${o.title}${o.description ? ` (${o.description})` : ""}`,
    )
    .join("\n");

  return buildPromptPayload({
    roleAndExpertise:
      'Sen saygın bir akademisyen, tez yazım editörü ve "Fikir & Sentez Düzenleyicisi" uzmanısın. Araştırmacının kütüphanesindeki dağınık alıntı fişlerini mantıksal temalara kümeliyor ve Word üzerinde yazarken takip edeceği ideal argüman akış sırasını planlıyorsun.',

    primaryTask:
      "Verilen alıntı fişlerini anlamsal temalarına göre gruplamak (Semantik Kümeler) ve seçili bölüm (veya ana tez planı) için Word'de yazarken kullanılacak adım adım referans akış sırasını (Argüman Akış Sırası) oluşturmaktır.",

    rulesAndConstraints: `1. **Semantik Fikir Kümeleri:**
   - Farklı kaynaklardan gelen ama aynı kavramı veya tartışmayı besleyen fişleri ortak bir temada birleştir.
   - Açıkta kalan (EŞLENMEMİŞ) fişler için en uygun tez bölümünü (\`suggestedOutlineId\`) belirle.
   - Her fiş ID'si geçerli ve verilen listeden olmalıdır.

2. **Argüman Akış Sırası (Word Yazım Planı):**
   - Fişleri mantıksal bir sıraya diz: İddia/Tanım ➡️ Karşı Görüş/Şerh ➡️ Ampirik Kanıt ➡️ Sentez.
   - Her adım için yazarın Word'de iki fiş arasında köprü kurmasını sağlayacak pürüzsüz bir geçiş önerisi (\`transitionNote\`) yaz.

3. **Dil:** Tüm başlıklar, roller ve geçiş notları yüksek düzey akademik Türkçe olmalıdır.`,

    workflowSteps: `1. Tüm alıntı fişlerini ve tez bölümlerini incele.
2. Fişler arasındaki anlamsal örüntüleri tespit ederek tematik kümelere ayır.
3. Word'de metin yazımında kullanılacak mantıksal akış dizilimini oluştur.
4. JSON nesnesini üret.`,

    outputFormat: "Belirtilen JSON şemasına tam uyumlu nesne.",

    inputContext: `${targetOutline ? `### ODAKLANILAN TEZ BÖLÜMÜ:\nID ${targetOutline.id}: ${targetOutline.title}\n${targetOutline.description || ""}\n\n` : ""}### TEZ İÇİNDEKİLER PLANI (OUTLINES):
${formattedOutlines}

### MEVCUT ALINTI FİŞLERİ (CITATION CARDS):
${formattedCards}`,

    taskTrigger:
      "Alıntı fişlerini semantik temalara göre kümele ve Word'de yazım için ideal mantıksal argüman akış sırasını JSON olarak üret.",
  });
}
