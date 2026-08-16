import { z } from "zod";
import { ThinkingLevel } from "@google/genai";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import {
  generateGeminiStructuredContent,
  type JsonSchema,
} from "@/services/ai";
import { getGeminiKeyPool } from "@/services/ai/gemini-key-pool";
import {
  createConcurrencyLimiter,
  type ConcurrencyLimiter,
} from "@/lib/rate-limiter";
import type { Logger } from "@/lib/logger";
import { buildPerThesisEvaluationPromptPayload } from "./prompts/per-thesis-evaluation.prompt";
import { strategicRoleEnum, type PositioningMatrixInput } from "./validation";
import type { SiftedThesis } from "./sifting";

/** Max concurrent per-thesis Gemini evaluations per API key. */
const CONCURRENCY_PER_KEY = 8;

/** Zod schema for the single-thesis strategic relevance/originality/role evaluation output. */
export const perThesisEvaluationSchema = z.object({
  externalThesisId: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .describe("Değerlendirilen tezin ID'si"),
  isRelevant: z
    .boolean()
    .describe(
      "Kullanıcının araştırma nesnesi/olgusal sahasıyla doğrudan alakalı mı?",
    ),
  relevanceReasoning: z
    .string()
    .optional()
    .describe(
      "Tezin ampirik olarak neden ilgili veya ilgisiz olduğuna dair somut gerekçe (1-2 cümle)",
    ),
  isDirectOverlap: z
    .boolean()
    .describe(
      "Kullanıcının tezi ile birebir örtüşme var mı (kullanıcı tezi özgün değil mi)?",
    ),
  strategicRole: strategicRoleEnum
    .optional()
    .describe(
      "Tezin kullanıcının tezindeki stratejik rolü: BROAD_CONTEXT | SPECIFIC_FOCUS | FOUNDATIONAL_WORK | METHODOLOGICAL_BENCHMARK | ALTERNATIVE_PERSPECTIVE",
    ),
  contributionAreas: z
    .array(z.string())
    .describe(
      "Tezin kullanıcının tezine katkı sağladığı/benzediği spesifik odak alanları (1-3 adet)",
    ),
  literaturePosition: z
    .string()
    .describe("Tezin literatürdeki konumu ve ne yaptığı (1 net cümle)"),
  strategicUtility: z
    .string()
    .describe(
      "Tezin kullanıcının tezinde nasıl kullanılacağına ve hangi boşluğu dolduracağına dair stratejik rehber not (1-2 cümle)",
    ),
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
      description:
        "Kullanıcının araştırma nesnesi/olgusal sahasıyla doğrudan alakalı mı? İlgisiz tezlerde false.",
    },
    relevanceReasoning: {
      type: "string",
      description:
        "Tezin ampirik olarak neden ilgili veya ilgisiz olduğuna dair somut gerekçe (1-2 cümle)",
    },
    isDirectOverlap: {
      type: "boolean",
      description:
        "Kullanıcının tezi ile birebir örtüşme var mı (kullanıcı tezi özgün değil mi)?",
    },
    strategicRole: {
      type: "string",
      enum: [
        "BROAD_CONTEXT",
        "SPECIFIC_FOCUS",
        "FOUNDATIONAL_WORK",
        "METHODOLOGICAL_BENCHMARK",
        "ALTERNATIVE_PERSPECTIVE",
      ],
      description:
        "Tezin stratejik rolü: BROAD_CONTEXT (Geniş Çerçeve), SPECIFIC_FOCUS (Kısmi Odak), FOUNDATIONAL_WORK (Öncül Çalışma), METHODOLOGICAL_BENCHMARK (Yöntem Rehberi), ALTERNATIVE_PERSPECTIVE (Karşıt Yaklaşım).",
    },
    contributionAreas: {
      type: "array",
      items: { type: "string" },
      description:
        "Tezin kullanıcının tezine katkı sağladığı spesifik odak alanları (1-3 adet). İlgisiz tezlerde boş dizi [].",
    },
    literaturePosition: {
      type: "string",
      description:
        "Tezin literatürdeki konumu ve ne yaptığı (1 net cümle). İlgisiz tezlerde boş string.",
    },
    strategicUtility: {
      type: "string",
      description:
        "Tezin kullanıcının tezinde nasıl kullanılacağına ve hangi boşluğu dolduracağına dair stratejik rehber not (1-2 cümle). İlgisiz tezlerde boş string.",
    },
  },
  required: [
    "externalThesisId",
    "isRelevant",
    "isDirectOverlap",
    "contributionAreas",
    "literaturePosition",
    "strategicUtility",
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
  const payload = buildPerThesisEvaluationPromptPayload(input, thesis);

  const result = await generateGeminiStructuredContent<PerThesisEvaluation>(
    FLASH_LITE_35,
    payload.systemInstruction,
    payload.userPrompt,
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

/**
 * Evaluates all candidate theses independently in parallel,
 * distributed round-robin across the Gemini API key pool and throttled to
 * `CONCURRENCY_PER_KEY` simultaneous evaluations per key.
 *
 * Each thesis is assessed in its own dedicated LLM call to guarantee
 * absolute, non-relative evaluation accuracy without inter-thesis bias.
 *
 * @param input - The validated positioning matrix input.
 * @param theses - The full list of candidate theses to evaluate.
 * @param logger - Optional structured logger for pipeline events.
 * @returns The evaluated theses that were successfully processed, matching original order.
 */
export async function evaluateThesesInParallel(
  input: PositioningMatrixInput,
  theses: SiftedThesis[],
  logger?: Logger,
): Promise<EvaluatedThesis[]> {
  if (theses.length === 0) return [];

  const apiKeys = getGeminiKeyPool().keys;
  const startTime = performance.now();

  logger?.info("positioning_per_thesis_evaluation_start", {
    service: "positioning",
    filePath: "src/features/positioning/per-thesis-evaluation.ts",
    data: {
      total: theses.length,
      keyCount: apiKeys.length,
      concurrencyPerKey: CONCURRENCY_PER_KEY,
      mode: "individual_parallel",
    },
  });

  const limiterByKey = new Map<string, ConcurrencyLimiter>();
  for (const apiKey of apiKeys) {
    limiterByKey.set(apiKey, createConcurrencyLimiter(CONCURRENCY_PER_KEY));
  }

  const settled = await Promise.allSettled(
    theses.map((thesis, idx) => {
      const assignedKey =
        apiKeys.length > 0 ? apiKeys[idx % apiKeys.length] : undefined;
      const limiter = assignedKey ? limiterByKey.get(assignedKey) : undefined;
      const task = () =>
        evaluateSingleThesis(input, thesis, assignedKey, logger);
      return limiter ? limiter.exec(task) : task();
    }),
  );

  const allEvaluated: EvaluatedThesis[] = [];

  for (let idx = 0; idx < settled.length; idx++) {
    const res = settled[idx];
    const thesis = theses[idx];
    if (res.status === "fulfilled") {
      allEvaluated.push({
        thesis,
        evaluation: res.value,
      });
    } else {
      logger?.error("positioning_per_thesis_single_failed", {
        service: "positioning",
        filePath: "src/features/positioning/per-thesis-evaluation.ts",
        data: {
          thesisId: thesis.id,
          thesisTitle: thesis.title,
        },
        error: res.reason,
      });
    }
  }

  logger?.info("positioning_per_thesis_evaluation_success", {
    service: "positioning",
    filePath: "src/features/positioning/per-thesis-evaluation.ts",
    durationMs: Math.round(performance.now() - startTime),
    data: {
      total: theses.length,
      evaluatedCount: allEvaluated.length,
      relevantCount: allEvaluated.filter((e) => e.evaluation.isRelevant).length,
    },
  });

  return allEvaluated;
}
