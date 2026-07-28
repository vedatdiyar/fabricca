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
  isFoundational: boolean;
  reasoning: string;
}

export interface SingleBoxJuryResult {
  thesisBoxId: number;
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
  isFoundational: z.boolean(),
  reasoning: z.string().min(1),
});

const singleBoxJuryOutputSchema = z.object({
  evaluations: z.array(juryEvaluationSchema),
});

// ============================================================================
// Vanilla JSON Schema (for Gemini responseJsonSchema)
// ============================================================================

const juryJsonSchema: JsonSchema = {
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
          isFoundational: {
            type: "boolean",
            description:
              "Box konusunda literatürün temel/kurucu referans noktası mı?",
          },
          reasoning: {
            type: "string",
            description: "Türkçe 1 cümlelik kabul/ret gerekçesi",
          },
        },
        required: [
          "thesisBoxId",
          "subBoxTitle",
          "articleTitle",
          "openAlexId",
          "isRelevant",
          "relevanceScore",
          "isFoundational",
          "reasoning",
        ],
      },
    },
  },
  required: ["evaluations"],
};

// ============================================================================
// Single-Box Jury Call
// ============================================================================

/**
 * Runs an isolated jury evaluation for a SINGLE sub-box.
 * Each box gets its own tailored prompt with box-type-specific instructions.
 *
 * SUBJECT_PROBLEM boxes receive a dynamic warning derived from thesisSubject,
 * box title, and box description — requiring case-specific works and rejecting
 * general theories unrelated to the thesis context.
 *
 * THEORETICAL_FRAMEWORK / METHODOLOGY boxes prioritise respected handbooks
 * and foundational texts, filtering narrow case studies.
 *
 * Per-article payload: title, authors (first 3 + et al.), abstract (120 words),
 * and OpenAlex relevance_score. No OpenAlex ID or URL is sent.
 *
 * Uses Gemini Flash-Lite with High thinking level and BLOCK_ONLY_HIGH safety settings.
 *
 * @param thesisSubject - The thesis subject problem text (ana tez konusu)
 * @param input - Single box context with its article pool
 * @param logger - Optional Logger instance
 * @returns SingleBoxJuryResult with evaluations for every article in this box
 */
export async function evaluateSingleBoxJury(
  thesisSubject: string,
  input: JuryInputItem,
  logger?: Logger,
): Promise<SingleBoxJuryResult> {
  const { box, articles } = input;

  if (articles.length === 0) {
    return { thesisBoxId: box.thesisBoxId, evaluations: [] };
  }

  const isSubjectProblem = box.boxType === "SUBJECT_PROBLEM";

  const articlesText = articles
    .map(
      (a, idx) =>
        `  Makale ${idx + 1}: "${a.title ?? "(başlık yok)"}"\n` +
        `     Authors: ${a.authors.slice(0, 3).join(", ") || "(bilinmiyor)"}${a.authors.length > 3 ? " et al." : ""}\n` +
        `     Abstract: ${a.abstract ?? "(özet yok)"}\n` +
        `     OpenAlex Relevance Score: ${(a.relevanceScore ?? 0).toFixed(4)}`,
    )
    .join("\n\n");

  const boxTypeInstruction = isSubjectProblem
    ? `⚠️ ÖNEMLİ — VAKA KUTUSU (SUBJECT_PROBLEM):
Bu kutu TEZİN SPESİFİK VAKASINI analiz eden bir VAKA KUTUSUDUR.
Tez Konusu: "${thesisSubject}" | Kutu Bağlamı: "${box.subBoxTitle}" - ${box.description}.
Makalelerin MUTLAKA yukarıda belirtilen tez konusunun ve kutu bağlamının spesifik aktörlerini, tarihsel/coğrafi bağlamını ve vakasını işlemesi ŞARTTIR.
Genel/jenerik teorileri veya başka ülke/toplumsal hareket vakalarını öne çıkaran makaleler bu kutu için ALAKASIZDIR ve elenmelidir.`
    : `- **THEORETICAL_FRAMEWORK / METHODOLOGY türündeki kutular için:** Makalenin bizzat tezin spesifik vakasını işlemesi zorunlu değildir. Ancak bu kutularda alanın literatürde kabul görmüş üst düzey, saygın, metodolojik/teorik el kitapları ve kurucu metinleri önceliklendirilmeli; tezin vaka analiziyle ilişkilendirilemeyecek marjinal, dar kapsamlı spesifik vaka incelemeleri (örneğin alakasız toplumsal hareketler) elenmelidir.`;

  const systemInstruction = `# Rol ve Uzmanlık

Sen, OpenAlex'ten dönen akademik makaleleri belirli bir tez alt kutusu bağlamında değerlendiren uzman bir akademik jüri üyesisin.

# Birincil Görev

Her bir makaleyi, içinde bulunduğu alt kutunun türü, başlığı ve açıklaması ile karşılaştırarak değerlendir. Makalenin kutu bağlamıyla doğrudan alakalı olup olmadığına karar ver, 0-100 arası gerçek alaka skoru belirle, kurucu eser (foundational work) olup olmadığını işaretle ve 1 cümlelik Türkçe gerekçe yaz.

# Kutu Türü ve Değerlendirme Kuralı

Bu kutu türü: **${box.boxType}**
Kutu Başlığı: ${box.subBoxTitle}
Kutu Açıklaması: ${box.description}

${boxTypeInstruction}

# Değerlendirme Kriterleri

- Her makale için başlık, abstract metni ve OpenAlex relevance_score bilgisi verilmiştir.
- Makalenin kutu bağlamına uygunluğunu değerlendir.
- Sadece gerçekten kurucu metinler için isFoundational=true kullan.

# Çıktı Biçimi

Her değerlendirme için aşağıdaki alanları içeren JSON nesneleri dizisi döndürün:
- thesisBoxId: ${box.thesisBoxId}
- subBoxTitle: "${box.subBoxTitle}"
- articleTitle: makale başlığı (aynen)
- isRelevant: boolean
- relevanceScore: 0-100 arası tam sayı
- isFoundational: boolean
- reasoning: Türkçe 1 cümlelik gerekçe`;

  const prompt = `# Girdi Bağlamı

Tez Konusu (Subject Problem): ${thesisSubject}

Kutu: [Box ${box.thesisBoxId}] "${box.subBoxTitle}" (${box.boxType})
Açıklama: ${box.description}

Makaleler:
${articlesText}

# İşlem

Yukarıdaki ${articles.length} makaleyi değerlendir ve her biri için thesisBoxId, subBoxTitle, articleTitle, isRelevant, relevanceScore (0-100), isFoundational, reasoning (Türkçe) alanlarını içeren JSON dizisi döndür.`;

  const raw = await generateStructuredContent<{
    evaluations: JuryEvaluation[];
  }>(FLASH_LITE_31, systemInstruction, prompt, juryJsonSchema, logger, {
    thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
    zodSchema: singleBoxJuryOutputSchema,
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
    payloadStage: "literature_single_box_jury",
    quiet: true,
  });

  return { thesisBoxId: box.thesisBoxId, evaluations: raw.evaluations ?? [] };
}
