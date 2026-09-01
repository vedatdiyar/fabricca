import {
  generateGeminiStructuredContent,
  type JsonSchema,
} from "@/core/services/ai";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import {
  buildJuryPromptPayload,
  type ThesisMatrixContext,
} from "../_prompts/batch-jury.prompt";
import { ThinkingLevel, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Logger } from "@/lib/logger";
import { extractOpenAlexId } from "@/lib/academic/utils";
import { z } from "zod";
import type { RawPaper } from "./literature-review-papers";

export type { ThesisMatrixContext } from "../_prompts/batch-jury.prompt";

export interface JuryBoxContext {
  thesisBoxId: number;
  subBoxTitle: string;
  boxType: string;
  description: string;
  concepts?: string[];
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
  reasoning: string;
}

export interface SingleBoxJuryResult {
  thesisBoxId: number;
  evaluations: JuryEvaluation[];
}

const juryEvaluationSchema = z.object({
  thesisBoxId: z.number().int().min(0),
  subBoxTitle: z.string().min(1),
  articleTitle: z
    .string()
    .default("")
    .transform((v) => v.trim()),
  openAlexId: z
    .string()
    .nullable()
    .transform((v) => extractOpenAlexId(v)),
  isRelevant: z.boolean(),
  relevanceScore: z.number().int().min(0).max(100),
  reasoning: z.string().min(1),
});

const singleBoxJuryOutputSchema = z.object({
  evaluations: z.array(juryEvaluationSchema),
});

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
          openAlexId: {
            type: "string",
            description:
              "Makalenin gerçek OpenAlex ID'si (W... formatında). Bilinmiyorsa string 'null' değil, JSON null gönder.",
          },
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
          "reasoning",
        ],
      },
    },
  },
  required: ["evaluations"],
};

/**
 * Runs a jury evaluation for a single sub-box with a box-type-specific prompt.
 *
 * @param thesisContext - The thesis subject string or the holistic ThesisMatrixContext.
 * @param input - The sub-box context and raw articles to evaluate.
 * @param logger - Optional pipeline logger.
 * @returns The structured evaluations for this sub-box.
 */
const CJK_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u30FF\uAC00-\uD7AF]/;

/**
 * Returns true when text contains Han/Kana/Hangul characters.
 *
 * @param text - Candidate title or abstract.
 * @returns True when CJK detected.
 */
function containsCjk(text: string | null | undefined): boolean {
  if (!text) return false;
  return CJK_RE.test(text);
}

export async function evaluateSingleBoxJury(
  thesisContext: string | ThesisMatrixContext | undefined,
  input: JuryInputItem,
  logger?: Logger,
): Promise<SingleBoxJuryResult> {
  const { box, articles } = input;

  if (articles.length === 0) {
    return { thesisBoxId: box.thesisBoxId, evaluations: [] };
  }

  // Pre-filter CJK papers before LLM: avoids priming FLASH_LITE with Han tokens
  // and resolves the LANGUAGE_GUARD vs verbatim-echo contradiction.
  const cjkBlocked = articles.filter(
    (a) => containsCjk(a.title) || containsCjk(a.abstract),
  );
  const cleanArticles = articles.filter(
    (a) => !containsCjk(a.title) && !containsCjk(a.abstract),
  );

  const blockedEvaluations: JuryEvaluation[] = cjkBlocked.map((a) => ({
    thesisBoxId: box.thesisBoxId,
    subBoxTitle: box.subBoxTitle,
    articleTitle: a.title ?? "(başlık yok)",
    openAlexId: extractOpenAlexId(a.openAlexId),
    isRelevant: false,
    relevanceScore: 0,
    reasoning:
      "Başlık veya özet Çince/Japonca/Korece karakter içerdiğinden dil uygunluğu nedeniyle elenmiştir.",
  }));

  if (cleanArticles.length === 0) {
    logger?.info("jury_cjk_prefilter_all_blocked", {
      service: "gemini",
      data: {
        thesisBoxId: box.thesisBoxId,
        subBoxTitle: box.subBoxTitle,
        totalArticles: articles.length,
        blockedCount: blockedEvaluations.length,
      },
    });
    return { thesisBoxId: box.thesisBoxId, evaluations: blockedEvaluations };
  }

  if (blockedEvaluations.length > 0) {
    logger?.info("jury_cjk_prefilter_partial", {
      service: "gemini",
      data: {
        thesisBoxId: box.thesisBoxId,
        subBoxTitle: box.subBoxTitle,
        totalArticles: articles.length,
        blockedCount: blockedEvaluations.length,
        cleanCount: cleanArticles.length,
      },
    });
  }

  const isMatrixObj =
    typeof thesisContext === "object" && thesisContext !== null;
  const matrixObj = isMatrixObj ? thesisContext : undefined;
  const subjectStr = isMatrixObj
    ? thesisContext.subjectProblem || ""
    : typeof thesisContext === "string"
      ? thesisContext
      : "";

  // Evaluate clean articles in parallel chunks of at most 10 items (eliminates lost-in-the-middle and gives 6x speedup)
  const JURY_BATCH_CHUNK_SIZE = 10;
  const chunks: RawPaper[][] = [];
  for (let i = 0; i < cleanArticles.length; i += JURY_BATCH_CHUNK_SIZE) {
    chunks.push(cleanArticles.slice(i, i + JURY_BATCH_CHUNK_SIZE));
  }

  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      const articlesText = chunk
        .map((a, idx) => {
          const sourceLabel =
            a.source === "qdrant"
              ? "YÖK Ulusal Tez Merkezi"
              : a.source === "exa"
                ? "DergiPark"
                : a.source === "semantic_scholar"
                  ? "Semantic Scholar"
                  : "OpenAlex";

          const typeLabel =
            a.publicationType || (a.source === "qdrant" ? "Tez" : "Makale");

          // Defensive: strip any residual CJK even after pre-filter (e.g. publisher field)
          const safeTitle = (a.title ?? "(başlık yok)").replace(
            new RegExp(CJK_RE, "g"),
            "",
          );
          const safeAbstract = (a.abstract ?? "(özet yok)").replace(
            new RegExp(CJK_RE, "g"),
            "",
          );
          const safePublisher = (
            a.publisher ||
            a.metadata ||
            "(belirtilmemiş)"
          ).replace(new RegExp(CJK_RE, "g"), "");

          return (
            `  Çalışma ${idx + 1}: "${safeTitle}"\n` +
            `     Tür: ${typeLabel} | Kaynak: ${sourceLabel}\n` +
            `     Yazarlar: ${a.authors.slice(0, 3).join(", ") || "(bilinmiyor)"}${a.authors.length > 3 ? " et al." : ""}\n` +
            `     Yayıncı/Kurum: ${safePublisher}\n` +
            `     Özet: ${safeAbstract}`
          );
        })
        .join("\n\n");

      const payload = buildJuryPromptPayload({
        thesisSubject: subjectStr,
        thesisMatrix: matrixObj,
        thesisBoxId: box.thesisBoxId,
        subBoxTitle: box.subBoxTitle,
        boxType: box.boxType,
        description: box.description,
        concepts: box.concepts,
        articlesText,
        articleCount: chunk.length,
      });

      const raw = await generateGeminiStructuredContent<{
        evaluations: JuryEvaluation[];
      }>(
        FLASH_LITE_35,
        payload.systemInstruction,
        payload.userPrompt,
        juryJsonSchema,
        logger,
        {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
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
        },
      );

      return raw?.evaluations ?? [];
    }),
  );

  const cleanEvaluations = chunkResults.flat();
  return {
    thesisBoxId: box.thesisBoxId,
    evaluations: [...blockedEvaluations, ...cleanEvaluations],
  };
}
