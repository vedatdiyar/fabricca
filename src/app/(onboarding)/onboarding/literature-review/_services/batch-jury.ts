import {
  generateStructuredContent,
  type JsonSchema,
} from "@/lib/services/gemini";
import { FLASH_LITE_31, GEMINI_SEED } from "@/lib/constants";
import { ThinkingLevel, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Logger } from "@/lib/logger";
import { z } from "zod";
import type { RawPaper } from "./literature-review-papers";

// ============================================================================
// Types
// ============================================================================

export interface JuryBoxContext {
  thesisBoxId: number;
  subBoxTitle: string;
  boxType: string;
  description: string;
}

export interface JuryInputItem {
  box: JuryBoxContext;
  articles: RawPaper[];
}

export interface JuryEvaluation {
  thesisBoxId: number;
  subBoxTitle: string;
  articleTitle: string;
  openAlexId: string | null;
  isRelevant: boolean;
  relevanceScore: number;
  reason: string;
  cleanedTitle: string;
  cleanedAuthors: string;
}

export interface BatchJuryResult {
  evaluations: JuryEvaluation[];
}

// ============================================================================
// Zod Schema (Runtime Validation)
// ============================================================================

const juryEvaluationSchema = z.object({
  thesisBoxId: z.number().int().min(0),
  subBoxTitle: z.string().min(1),
  articleTitle: z.string().min(1),
  openAlexId: z.string().nullable(),
  isRelevant: z.boolean(),
  relevanceScore: z.number().int().min(0).max(100),
  reason: z.string().min(1),
  cleanedTitle: z.string().min(1),
  cleanedAuthors: z.string().min(1),
});

const batchJuryOutputSchema = z.object({
  evaluations: z.array(juryEvaluationSchema),
});

// ============================================================================
// Vanilla JSON Schema (for Gemini responseJsonSchema)
// ============================================================================

const batchJuryJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    evaluations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          thesisBoxId: { type: "integer", description: "Tez kutusu ID" },
          subBoxTitle: { type: "string", description: "Alt kutu başlığı" },
          articleTitle: { type: "string", description: "Makale başlığı" },
          openAlexId: { type: "string", description: "OpenAlex ID veya null" },
          isRelevant: {
            type: "boolean",
            description: "Makale box bağlamıyla alakalı mı?",
          },
          relevanceScore: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            description: "0-100 arası alaka skoru",
          },
          reason: {
            type: "string",
            description: "Türkçe 1 cümlelik kabul/ret gerekçesi",
          },
          cleanedTitle: {
            type: "string",
            description: "APA formatında temizlenmiş başlık",
          },
          cleanedAuthors: {
            type: "string",
            description: "Soyadı, A. B. formatında temizlenmiş yazarlar",
          },
        },
        required: [
          "thesisBoxId",
          "subBoxTitle",
          "articleTitle",
          "openAlexId",
          "isRelevant",
          "relevanceScore",
          "reason",
          "cleanedTitle",
          "cleanedAuthors",
        ],
      },
    },
  },
  required: ["evaluations"],
};

// ============================================================================
// Prompt
// ============================================================================

const BATCH_JURY_SYSTEM_INSTRUCTION = `# Rol ve Uzmanlık
Sen, OpenAlex'ten dönen akademik makaleleri tez alt kutuları bağlamında topluca değerlendiren uzman bir akademik jüri üyesisin.

# Birincil Görev
Her bir makaleyi, ait olduğu alt kutunun türü, başlığı ve açıklaması ile karşılaştırarak değerlendir. Makalenin tez/box bağlamıyla doğrudan alakalı olup olmadığına karar ver, 0-100 arası gerçek alaka skoru belirle ve 1 cümlelik Türkçe gerekçe yaz.

# Kurallar ve Sınırlamalar
- SUBJECT_PROBLEM türündeki kutular için: Makalenin tezin spesifik vakasını, tarihsel bağlamını ve aktörlerini işlemesi beklenir. Vaka uyumu ve kavramsal örtüşme birlikte değerlendirilir.
- THEORETICAL_FRAMEWORK türündeki kutular için: Makalenin tezin spesifik vakasını (Kürt hareketi, Türkiye vb.) işlemesi beklenmez. Teoriyi veya kavramsal çerçeveyi saf ve güçlü bir şekilde işleyen temel makaleler 90-100 puan almalıdır.
- METHODOLOGY türündeki kutular için: Makalenin tezin spesifik vakasını işlemesi beklenmez. Yöntemi veya analitik yaklaşımı saf ve güçlü şekilde işleyen metodolojik makaleler 90-100 puan almalıdır.
- Her makale için sadece başlık ve box açıklaması ile değerlendirme yapılır.

# Metin Temizleme Kuralları
Her makale için aşağıdaki temizleme işlemlerini de yap:
- \`cleanedTitle\`: Başlığı APA başlık formatına (cümle düzeni / sentence case) göre düzenle. İlk kelime ve özel isimler dışında küçük harf kullan. Türkçe karakterleri (ı, İ, ş, ç, ö, ü, ğ, Ş, Ç, Ö, Ü, İ, Ğ) düzelt. Gereksiz boşlukları ve noktalama hatalarını temizle.
- \`cleanedAuthors\`: Yazar isimlerini "Soyadı, A. B." formatında standartlaştır. Birden çok yazar varsa "; " ile ayır. Baş harf kısaltmalarını noktalı formata çevir. Türkçe karakterleri düzelt.

# Çıktı Biçimi
Her değerlendirme için \`thesisBoxId\`, \`subBoxTitle\`, \`articleTitle\`, \`openAlexId\`, \`isRelevant\`, \`relevanceScore\` (0-100 tam sayı), \`reason\` (Türkçe), \`cleanedTitle\` (string) ve \`cleanedAuthors\` (string) alanlarını içeren JSON nesneleri dizisi döndürün.`;

// ============================================================================
// Main Function
// ============================================================================

/**
 * Evaluates all candidate articles from all active sub-boxes in a single
 * batch LLM call. Uses Gemini Flash-Lite with High thinking budget and
 * BLOCK_ONLY_HIGH safety settings.
 *
 * The jury applies type-aware isolation rules:
 * - SUBJECT_PROBLEM: case-specific relevance expected
 * - THEORETICAL_FRAMEWORK / METHODOLOGY: pure theory/method focus rewarded
 *
 * @param thesisSubject - The thesis subject problem text (ana tez konusu)
 * @param inputs - Array of box contexts with their raw OpenAlex articles
 * @param logger - Optional Logger instance
 * @returns BatchJuryResult with evaluations for every article
 */
export async function evaluateBatchJury(
  thesisSubject: string,
  inputs: JuryInputItem[],
  logger?: Logger,
): Promise<BatchJuryResult> {
  if (inputs.length === 0) {
    return { evaluations: [] };
  }

  const allArticles = inputs.reduce((sum, i) => sum + i.articles.length, 0);
  if (allArticles === 0) {
    return { evaluations: [] };
  }

  const boxSection = inputs
    .map(
      (input) => {
        const box = input.box;
        const articlesText = input.articles
          .map(
            (a, idx) =>
              `  Makale ${idx + 1}: "${a.title ?? "(başlık yok)"}"\n     Authors: ${a.authors.slice(0, 3).join(", ") || "(bilinmiyor)"}${a.authors.length > 3 ? " et al." : ""}\n     OpenAlex ID: ${a.openAlexId ?? "(yok)"}\n     İlgili özet/bağlam: ${a.metadata ?? "(özet yok)"}`,
          )
          .join("\n\n");

        return `[Box ${box.thesisBoxId}] "${box.subBoxTitle}" (${box.boxType})
Açıklama: ${box.description ?? "(yok)"}

Makaleler:
${articlesText}`;
      },
    )
    .join("\n\n---\n\n");

  const prompt = `# Girdi Bağlamı

Tez Konusu (Subject Problem): ${thesisSubject}

Kutular ve Makaleler:
${boxSection}

# İşlem Adımları
1. Her bir kutunun türünü belirle (SUBJECT_PROBLEM, THEORETICAL_FRAMEWORK, METHODOLOGY).
2. Her makaleyi kendi kutusunun türüne uygun değerlendirme kriteriyle analiz et:
   - SUBJECT_PROBLEM: vaka ve kavramsal uyum ara.
   - THEORETICAL_FRAMEWORK: saf teori gücüne bak, vaka arama.
   - METHODOLOGY: yöntemsel değere bak, vaka arama.
3. Alakasız makaleleri isRelevant=false ile işaretle.
4. Alakalı makalelere 0-100 arası gerçek skor ver.
5. Her makale için başlık ve yazar isimlerini temizle (cleanedTitle, cleanedAuthors).

# Birincil Görev
Tüm makaleler için değerlendirme sonuçlarını JSON dizisi olarak döndür.`;

  const result = await generateStructuredContent<BatchJuryResult>(
    FLASH_LITE_31,
    BATCH_JURY_SYSTEM_INSTRUCTION,
    prompt,
    batchJuryJsonSchema,
    logger,
    {
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      zodSchema: batchJuryOutputSchema,
      seed: GEMINI_SEED,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
      payloadStage: "literature_batch_jury_evaluation",
      quiet: true,
    },
  );

  return result;
}
