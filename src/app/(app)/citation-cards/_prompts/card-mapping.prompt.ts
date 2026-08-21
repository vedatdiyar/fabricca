import { z } from "zod";
import type { JsonSchema } from "@/core/services/ai";
import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";

export const cardMappingItemSchema = z.object({
  annotationId: z.number(),
  suggestedOutlineId: z.number(),
  confidenceScore: z.number().min(0).max(1),
  rationale: z.string(),
});

export const cardMappingResponseSchema = z.object({
  mappings: z.array(cardMappingItemSchema),
});

export type CardMappingResponse = z.infer<typeof cardMappingResponseSchema>;

export const cardMappingJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    mappings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          annotationId: { type: "number" },
          suggestedOutlineId: { type: "number" },
          confidenceScore: { type: "number" },
          rationale: { type: "string" },
        },
        required: [
          "annotationId",
          "suggestedOutlineId",
          "confidenceScore",
          "rationale",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["mappings"],
};

export interface CardMappingInput {
  matrix: {
    subjectProblem: string;
    theoreticalFramework: string;
    methodology: string;
    primaryMaterial?: string | null;
  };
  outlines: Array<{
    id: number;
    parentId: number | null;
    title: string;
    description: string | null;
    sortOrder: number;
  }>;
  cards: Array<{
    id: number;
    content: string;
    noteType: string;
    comment?: string;
    sourceTitle: string;
    sourceAuthors: string[];
    boxTitle: string;
    boxType: string;
  }>;
}

/**
 * Builds the standardized PromptPayload for matching unassigned citation cards to thesis outline sections.
 * Adheres strictly to docs/LLM_INTEGRATION.md (Hybrid XML + Markdown encapsulation).
 *
 * @param input - The thesis matrix, outline tree, and cards to map.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildCardMappingPromptPayload(
  input: CardMappingInput,
): PromptPayload {
  const { matrix, outlines, cards } = input;

  const outlineListText = outlines
    .map(
      (o) =>
        `- [ID: ${o.id}] (Üst Bölüm ID: ${o.parentId ?? "Ana Bölüm"}, Sıra: ${o.sortOrder}) "${o.title}"${o.description ? ` — Açıklama: ${o.description}` : ""}`,
    )
    .join("\n");

  const cardsListText = cards
    .map(
      (c) => `---
[Fiş ID: ${c.id}]
- Kutu / Kadran: ${c.boxTitle} (${c.boxType})
- Kaynak: "${c.sourceTitle}" (Yazarlar: ${c.sourceAuthors.join(", ") || "Belirtilmemiş"})
- Not Türü: ${c.noteType}
- Alıntı İçeriği: "${c.content}"
${c.comment ? `- Araştırmacı Notu: "${c.comment}"` : ""}`,
    )
    .join("\n\n");

  return buildPromptPayload({
    roleAndExpertise:
      "Siz, Türkiye lisansüstü tez standartlarında (YÖK ve SBE) uzmanlaşmış, akademik argüman yapısı ve literatür sentezi konusunda kıdemli bir tez danışmanısınız.",

    primaryTask:
      "Verilen alıntı fişlerinin (citation cards) argümantatif ve kuramsal içeriğini analiz ederek, her bir fişi tez iskeletinde (outline) en uygun alt başlığa (veya ana bölüme) eşleştirmek ve kısa bir akademik gerekçe üretmektir.",

    rulesAndConstraints: `## Eşleme ve Karar Kuralları
1. **Alt Bölüm Önceliği:** Mümkünse fişleri doğrudan ilgili odaklanmış alt bölümlere (subSections) eşleştirin. Eğer fiş tüm bölümü kapsayan genel bir argüman ise ana bölüme eşleştirebilirsiniz.
2. **Semantik Uyum:** Fişin kuramsal kavramları, tartışması ve varsa araştırmacı notu ile eşleştirilen başlığın tanımı ve kapsamı örtüşmelidir.
3. **confidenceScore:** 0.0 ile 1.0 arasında bir güven puanı belirleyin (Örn: 0.85 = Yüksek uyum).
4. **rationale (Gerekçe):** Fişin neden o bölüme atandığını açıklayan maksimum 1-2 cümlelik, duru akademik Türkçe ile yazılmış net bir gerekçe cümlesi yazın (Örn: "Bu alıntı, 2.1 alt başlığındaki sermaye birikimi ve kentsel rant argümanını doğrudan temellendirmektedir.").
5. **Eksiksiz Listeleme:** Girdide sunulan her bir Fiş ID'si (annotationId) için çıktı listesinde bir eşleme nesnesi üretilmelidir.`,

    workflowSteps: `1. Tez matrisini ve tez iskeletindeki başlıkların kapsamını incele.
2. Her bir alıntı fişinin argümanını, kaynak bilgisini ve araştırmacı notunu değerlendir.
3. Fişin en güçlü kanıt/argüman oluşturacağı en uygun Outline ID'sini seç.
4. Güven puanı ve tek cümlelik akademik gerekçe ile JSON formatında yanıtla.`,

    outputFormat:
      "Yanıt yalnızca belirtilen JSON şemasına harfiyen uyan saf JSON nesnesi olmalıdır.",

    examples: `<example>
<input>
Tez İskeleti:
- [ID: 101] "1. Giriş: Araştırmanın Problemi ve Amacı"
- [ID: 102] "2.1. Neoliberal Devlet ve Kentsel Mekânın Metalaşması"
- [ID: 103] "3.2. Belediye Meclis Kararlarının Ampirik Analizi"

Fişler:
[Fiş ID: 55]
- Kutu: Kuramsal Çerçeve (THEORETICAL_FRAMEWORK)
- Kaynak: "The Limits to Capital" (David Harvey)
- Alıntı: "Kentsel mekân sermaye krizlerini soğurmak için kullanılır."
</input>
<output>
{
  "mappings": [
    {
      "annotationId": 55,
      "suggestedOutlineId": 102,
      "confidenceScore": 0.95,
      "rationale": "Bu alıntı, 2.1 alt başlığındaki sermaye birikimi ve kentsel rant teorisini doğrudan desteklemektedir."
    }
  ]
}
</output>
</example>`,

    inputContext: `### TEZ MATRİSİ:
- Problem: ${matrix.subjectProblem}
- Kuramsal Çerçeve: ${matrix.theoreticalFramework}
- Metodoloji: ${matrix.methodology}
${matrix.primaryMaterial ? `- Birincil Materyal: ${matrix.primaryMaterial}` : ""}

### TEZ İSKELETİ (OUTLINE BAŞLIKLARI):
${outlineListText || "Henüz bölüm bulunmuyor."}

### EŞLENECEK ALINTI FİŞLERİ:
${cardsListText || "Fiş bulunmuyor."}`,

    taskTrigger:
      "Yukarıdaki <context> içeriğindeki alıntı fişlerini analiz et ve her birini en uygun tez bölümüne eşleştirerek JSON formatında çıktıyı üret.",
  });
}
