import {
  generateStructuredContent,
  type JsonSchema,
} from "@/lib/services/gemini";
import { FLASH_LITE_31, GEMINI_SEED } from "@/lib/constants";
import { buildJurySystemInstruction, buildJuryUserPrompt } from "@/lib/prompts";
import { ThinkingLevel, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Logger } from "@/lib/logger";
import { extractOpenAlexId } from "@/lib/academic/utils";
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
  openAlexId: z
    .string()
    .nullable()
    .transform((v) => extractOpenAlexId(v)),
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

  const articlesText = articles
    .map(
      (a, idx) =>
        `  Makale ${idx + 1}: "${a.title ?? "(başlık yok)"}"\n` +
        `     Authors: ${a.authors.slice(0, 3).join(", ") || "(bilinmiyor)"}${a.authors.length > 3 ? " et al." : ""}\n` +
        `     Abstract: ${a.abstract ?? "(özet yok)"}\n` +
        `     OpenAlex Relevance Score: ${(a.relevanceScore ?? 0).toFixed(4)}` +
        (a.isCoCitationLeader
          ? `\n     Ko-Atıf Lideri: Evet (Atıf Sıklığı: ${a.ccFreq})`
          : ""),
    )
    .join("\n\n");

  const systemInstruction = buildJurySystemInstruction(
    box.boxType,
    box.subBoxTitle,
    box.description,
    box.thesisBoxId,
    thesisSubject,
  );

  const prompt = buildJuryUserPrompt(
    thesisSubject,
    box.thesisBoxId,
    box.subBoxTitle,
    box.boxType,
    box.description,
    articlesText,
    articles.length,
  );

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
