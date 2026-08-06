import { z } from "zod";
import { ThinkingLevel } from "@google/genai";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import {
  generateStructuredContent,
  type JsonSchema,
} from "@/lib/services/gemini";
import type { Logger } from "@/lib/logger";
import {
  PER_THESIS_EVALUATION_SYSTEM_INSTRUCTION,
  buildPerThesisEvaluationUserPrompt,
} from "@/lib/prompts";
import type { PositioningMatrixInput } from "../_lib/validation";
import type { SiftedThesis } from "./sifting";

/** Zod schema for the single-thesis relevance/originality/contribution evaluation output. */
export const perThesisEvaluationSchema = z.object({
  externalThesisId: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .describe("Değerlendirilen tezin ID'si"),
  isRelevant: z.boolean().describe("Kullanıcının teziyle alakalı mı?"),
  isDirectOverlap: z
    .boolean()
    .describe(
      "Kullanıcının tezi ile birebir örtüşme var mı (kullanıcı tezi özgün değil mi)?",
    ),
  contributionAreas: z
    .array(z.string())
    .describe(
      "Tezin kullanıcının tezine katkı sağladığı/benzediği spesifik alanlar",
    ),
  relevanceReason: z
    .string()
    .describe(
      "Tezin kullanıcının tezinde nasıl kullanılacağına dair rehber not",
    ),
  literaturePosition: z
    .string()
    .describe("Tezin literatürdeki konumu ve temel sorunsalı (derdi)"),
});

/** Inferred type for a single-thesis evaluation result. */
export type PerThesisEvaluation = z.infer<typeof perThesisEvaluationSchema>;

/** JSON Schema for Gemini structured outputs of the per-thesis evaluation. */
export const perThesisEvaluationJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    externalThesisId: {
      type: "string",
      description: "Değerlendirilen tezin ID'si",
    },
    isRelevant: {
      type: "boolean",
      description: "Kullanıcının teziyle alakalı mı? İlgisiz tezlerde false.",
    },
    isDirectOverlap: {
      type: "boolean",
      description:
        "Kullanıcının tezi ile birebir örtüşme var mı (kullanıcı tezi özgün değil mi)?",
    },
    contributionAreas: {
      type: "array",
      items: { type: "string" },
      description:
        "Tezin kullanıcının tezine katkı sağladığı/benzediği spesifik alanlar (ilgisiz veya birebir örtüşen tezlerde boş)",
    },
    relevanceReason: {
      type: "string",
      description:
        "Tezin kullanıcının tezinde nasıl kullanılacağına dair rehber not (ilgisiz veya birebir örtüşen tezlerde boş)",
    },
    literaturePosition: {
      type: "string",
      description:
        "Tezin literatürdeki konumu ve temel sorunsalı (derdi); ilgisiz tezlerde boş",
    },
  },
  required: [
    "externalThesisId",
    "isRelevant",
    "isDirectOverlap",
    "contributionAreas",
    "relevanceReason",
    "literaturePosition",
  ],
  additionalProperties: false,
};

/**
 * Evaluates a single thesis against the user's thesis matrix via the 3-stage decision chain.
 *
 * @param input - The validated positioning matrix input.
 * @param thesis - The single thesis candidate to evaluate.
 * @param apiKey - Optional Gemini API key override for multi-key load distribution.
 * @param logger - Optional structured logger for pipeline events.
 * @returns The structured per-thesis evaluation result.
 */
export async function evaluateSingleThesis(
  input: PositioningMatrixInput,
  thesis: SiftedThesis,
  apiKey?: string,
  logger?: Logger,
): Promise<PerThesisEvaluation> {
  const prompt = buildPerThesisEvaluationUserPrompt(input, thesis);

  const result = await generateStructuredContent<PerThesisEvaluation>(
    FLASH_LITE_35,
    PER_THESIS_EVALUATION_SYSTEM_INSTRUCTION,
    prompt,
    perThesisEvaluationJsonSchema,
    logger,
    {
      zodSchema: perThesisEvaluationSchema,
      payloadStage: "positioning_per_thesis_evaluation",
      seed: GEMINI_SEED,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      thesisMatrix: input,
      apiKey,
      quiet: true,
    },
  );

  return result;
}

/** A thesis paired with its per-thesis evaluation result. */
export interface EvaluatedThesis {
  thesis: SiftedThesis;
  evaluation: PerThesisEvaluation;
}

/** The chunk size used when distributing theses across the grouped Gemini API key pool. */
export const PER_THESIS_CHUNK_SIZE = 10;

/**
 * Runs the per-thesis evaluations for all candidates, distributing the theses in
 * chunks of 10 across the grouped Gemini key pool (GEMINI_API_KEY_1, _2, _3).
 *
 * @param input - The validated positioning matrix input.
 * @param theses - The full list of candidate theses to evaluate.
 * @param logger - Optional structured logger for pipeline events.
 * @returns The evaluated theses that were successfully processed, in original order.
 */
export async function evaluateThesesInParallel(
  input: PositioningMatrixInput,
  theses: SiftedThesis[],
  logger?: Logger,
): Promise<EvaluatedThesis[]> {
  if (theses.length === 0) return [];

  const apiKeys = [
    process.env.GEMINI_API_KEY_1 || undefined,
    process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY_1 || undefined,
    process.env.GEMINI_API_KEY_3 || process.env.GEMINI_API_KEY_1 || undefined,
  ].filter(Boolean) as string[];

  const startTime = performance.now();

  logger?.info("positioning_per_thesis_evaluation_start", {
    service: "positioning",
    filePath:
      "src/app/(onboarding)/onboarding/positioning/_services/per-thesis-evaluation.ts",
    data: {
      total: theses.length,
      keyCount: apiKeys.length,
    },
  });

  const settled = await Promise.allSettled(
    theses.map(async (thesis, idx) => {
      if (idx > 0) {
        await new Promise((resolve) => setTimeout(resolve, idx * 150));
      }
      return evaluateSingleThesis(
        input,
        thesis,
        apiKeys[idx % apiKeys.length],
        logger,
      );
    }),
  );

  const allEvaluated: EvaluatedThesis[] = [];
  for (let idx = 0; idx < settled.length; idx++) {
    const res = settled[idx];
    const thesis = theses[idx];
    if (res.status === "fulfilled") {
      allEvaluated.push({ thesis, evaluation: res.value });
    } else {
      logger?.error("positioning_per_thesis_evaluation_failed", {
        service: "positioning",
        filePath:
          "src/app/(onboarding)/onboarding/positioning/_services/per-thesis-evaluation.ts",
        data: { thesisId: thesis.id, thesisTitle: thesis.title },
        error: res.reason,
      });
    }
  }

  logger?.info("positioning_per_thesis_evaluation_success", {
    service: "positioning",
    filePath:
      "src/app/(onboarding)/onboarding/positioning/_services/per-thesis-evaluation.ts",
    durationMs: Math.round(performance.now() - startTime),
    data: { evaluatedCount: allEvaluated.length },
  });

  return allEvaluated;
}
