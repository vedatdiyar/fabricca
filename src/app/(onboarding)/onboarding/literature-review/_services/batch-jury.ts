import {
  generateGeminiStructuredContent,
  dispatchGeminiBatch,
  type JsonSchema,
} from "@/core/services/ai";
import { getProjectIndex } from "@/core/services/ai/gemini-key-pool";
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
 * Truncates text at sentence boundary to avoid cutting mid-sentence.
 * Used as safety buffer for anomalously long abstracts (>2500 chars).
 *
 * @param text - Full abstract text.
 * @param limit - Maximum character limit.
 * @returns Truncated text ending at last sentence terminator within limit.
 */
function truncateAtSentence(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const sliced = text.slice(0, limit);
  const lastSentenceEnd = Math.max(
    sliced.lastIndexOf("."),
    sliced.lastIndexOf("!"),
    sliced.lastIndexOf("?"),
  );
  // Keep sentence-complete truncation if terminator is not too early (>50% of limit)
  if (lastSentenceEnd > limit * 0.5) {
    return sliced.slice(0, lastSentenceEnd + 1).trimEnd();
  }
  const lastSpace = sliced.lastIndexOf(" ");
  if (lastSpace > limit * 0.7) {
    return sliced.slice(0, lastSpace).trimEnd();
  }
  return sliced.trimEnd();
}

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

export interface MultiBoxJuryChunkTask {
  box: JuryBoxContext;
  chunk: RawPaper[];
  chunkIdxInBox: number;
}

/**
 * Runs a unified global jury evaluation across ALL sub-boxes simultaneously.
 * Pools candidate chunks from all sub-boxes into a single global batch array and dispatches
 * evenly across all configured Gemini API keys with balanced concurrency.
 *
 * @param thesisContext - The thesis subject string or the holistic ThesisMatrixContext.
 * @param inputs - Array of sub-box contexts and candidate articles to evaluate.
 * @param logger - Optional pipeline logger.
 * @returns The structured evaluations grouped per sub-box.
 */
export async function evaluateMultiBoxJury(
  thesisContext: string | ThesisMatrixContext | undefined,
  inputs: JuryInputItem[],
  logger?: Logger,
): Promise<SingleBoxJuryResult[]> {
  if (inputs.length === 0) return [];

  const isMatrixObj =
    typeof thesisContext === "object" && thesisContext !== null;
  const matrixObj = isMatrixObj ? thesisContext : undefined;
  const subjectStr = isMatrixObj
    ? thesisContext.subjectProblem || ""
    : typeof thesisContext === "string"
      ? thesisContext
      : "";

  const globalTasks: MultiBoxJuryChunkTask[] = [];
  const blockedEvaluationsByBox = new Map<number, JuryEvaluation[]>();

  for (const input of inputs) {
    const { box, articles } = input;
    if (articles.length === 0) {
      blockedEvaluationsByBox.set(box.thesisBoxId, []);
      continue;
    }

    // Pre-filter CJK papers before LLM: avoids priming FLASH_LITE with Han tokens
    // and resolves the LANGUAGE_GUARD vs verbatim-echo contradiction.
    const cjkBlocked = articles.filter(
      (a) => containsCjk(a.title) || containsCjk(a.abstract),
    );
    const cleanArticles = articles.filter(
      (a) => !containsCjk(a.title) && !containsCjk(a.abstract),
    );

    const blocked: JuryEvaluation[] = cjkBlocked.map((a) => ({
      thesisBoxId: box.thesisBoxId,
      subBoxTitle: box.subBoxTitle,
      articleTitle: a.title ?? "(başlık yok)",
      openAlexId: extractOpenAlexId(a.openAlexId),
      isRelevant: false,
      relevanceScore: 0,
      reasoning:
        "Başlık veya özet Çince/Japonca/Korece karakter içerdiğinden dil uygunluğu nedeniyle elenmiştir.",
    }));
    blockedEvaluationsByBox.set(box.thesisBoxId, blocked);

    if (cleanArticles.length === 0) {
      logger?.info("jury_cjk_prefilter_all_blocked", {
        service: "gemini",
        data: {
          thesisBoxId: box.thesisBoxId,
          subBoxTitle: box.subBoxTitle,
          totalArticles: articles.length,
          blockedCount: blocked.length,
        },
      });
      continue;
    }

    if (blocked.length > 0) {
      logger?.info("jury_cjk_prefilter_partial", {
        service: "gemini",
        data: {
          thesisBoxId: box.thesisBoxId,
          subBoxTitle: box.subBoxTitle,
          totalArticles: articles.length,
          blockedCount: blocked.length,
          cleanCount: cleanArticles.length,
        },
      });
    }

    // Pass all clean articles for this box in a single unified task
    globalTasks.push({
      box,
      chunk: cleanArticles,
      chunkIdxInBox: 0,
    });
  }

  const cleanEvaluationsByBox = new Map<number, JuryEvaluation[]>();
  for (const input of inputs) {
    cleanEvaluationsByBox.set(input.box.thesisBoxId, []);
  }

  if (globalTasks.length > 0) {
    const chunkResults = await dispatchGeminiBatch<
      MultiBoxJuryChunkTask,
      JuryEvaluation[]
    >({
      items: globalTasks,
      model: FLASH_LITE_35,
      operation: "literature_single_box_jury",
      concurrencyPerKey: 2,
      logger,
      task: async (taskItem, globalIdx, target) => {
        const { box, chunk } = taskItem;
        const articlesText = chunk
          .map((a, idx) => {
            const sourceLabel =
              a.source === "qdrant"
                ? "YÖK Ulusal Tez Merkezi"
                : a.source === "exa"
                  ? "DergiPark"
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

            const citationBadge =
              a.citedByCount && a.citedByCount > 0
                ? ` [${a.citedByCount} Akademik Atıf - Yüksek Etki]`
                : "";

            let abstractText = "";
            if (
              safeAbstract &&
              safeAbstract.trim().length > 15 &&
              safeAbstract !== "(özet yok)"
            ) {
              // Akademik özetler genelde 1000-1500 karakterdir; tamamını koru, yalnızca bozuk/aşırı uzun veri anomalilerini sınırla.
              abstractText =
                safeAbstract.length > 2500
                  ? truncateAtSentence(safeAbstract, 2500)
                  : safeAbstract;
            } else {
              abstractText = `(Özet metni bulunmamaktadır. Bu eser ${safePublisher} tarafından yayımlanmış ${typeLabel} formatında bir çalışmadır${citationBadge}. Başlığı, yazarı ve konu uyumu üzerinden değerlendiriniz.)`;
            }

            return (
              `  Çalışma ${idx + 1}: "${safeTitle}"\n` +
              `     Tür: ${typeLabel} | Kaynak: ${sourceLabel} | Yıl: ${a.year || "(belirtilmemiş)"}${citationBadge}\n` +
              `     Yazarlar: ${a.authors.slice(0, 3).join(", ") || "(bilinmiyor)"}${a.authors.length > 3 ? " et al." : ""}\n` +
              `     Yayıncı/Kurum: ${safePublisher}\n` +
              `     Özet/İçerik: ${abstractText}`
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
            lane: "batch",
            targetKeyIndex: getProjectIndex(target.apiKey),
            quiet: true,
          },
        );

        return raw?.evaluations ?? [];
      },
    });

    // Collate chunk results into their respective boxes
    for (let i = 0; i < globalTasks.length; i++) {
      const taskItem = globalTasks[i];
      const evals = chunkResults[i] ?? [];
      const boxEvals = cleanEvaluationsByBox.get(taskItem.box.thesisBoxId) ?? [];
      boxEvals.push(...evals);
      cleanEvaluationsByBox.set(taskItem.box.thesisBoxId, boxEvals);
    }
  }

  return inputs.map((input) => {
    const boxId = input.box.thesisBoxId;
    const blocked = blockedEvaluationsByBox.get(boxId) ?? [];
    const clean = cleanEvaluationsByBox.get(boxId) ?? [];
    return {
      thesisBoxId: boxId,
      evaluations: [...blocked, ...clean],
    };
  });
}

/**
 * Runs a jury evaluation for a single sub-box with a box-type-specific prompt.
 *
 * @param thesisContext - The thesis subject string or the holistic ThesisMatrixContext.
 * @param input - The sub-box context and raw articles to evaluate.
 * @param logger - Optional pipeline logger.
 * @returns The structured evaluations for this sub-box.
 */
export async function evaluateSingleBoxJury(
  thesisContext: string | ThesisMatrixContext | undefined,
  input: JuryInputItem,
  logger?: Logger,
): Promise<SingleBoxJuryResult> {
  const [result] = await evaluateMultiBoxJury(
    thesisContext,
    [input],
    logger,
  );
  return result ?? { thesisBoxId: input.box.thesisBoxId, evaluations: [] };
}
