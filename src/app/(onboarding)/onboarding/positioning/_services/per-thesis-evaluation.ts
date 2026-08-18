import { z } from "zod";
import { ThinkingLevel } from "@google/genai";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import {
  generateGeminiStructuredContent,
  type JsonSchema,
} from "@/core/services/ai";
import type { Logger } from "@/lib/logger";
import { buildPerThesisEvaluationPromptPayload } from "../_prompts/per-thesis-evaluation.prompt";
import { strategicRoleEnum, type PositioningMatrixInput } from "./validation";
import type { SiftedThesis } from "./sifting";

/** Zod schema for the single-thesis strategic relevance/originality/role evaluation output. */
export const perThesisEvaluationSchema = z.object({
  externalThesisId: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .describe("Değerlendirilen tezin ID'si"),
  isRelevant: z
    .boolean()
    .describe(
      "Bu tezi okumadan geçmek ciddi bir akademik eksiklik olur mu? YALNIZCA gerçekten zorunlu okuma kalitesindeyse true. Tipik 35 adayda 0-3 tez true alır.",
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
      "Tezin kullanıcının tezindeki stratejik rolü: SPECIFIC_FOCUS | FOUNDATIONAL_WORK | METHODOLOGICAL_BENCHMARK | ALTERNATIVE_PERSPECTIVE",
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

/** Zod schema for batch thesis evaluation output. */
export const batchThesisEvaluationSchema = z.object({
  evaluations: z.array(perThesisEvaluationSchema),
});

/** Inferred type for batch thesis evaluation output. */
export type BatchThesisEvaluationOutput = z.infer<
  typeof batchThesisEvaluationSchema
>;

/** JSON Schema for single per-thesis evaluation item. */
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
        "Bu tezi okumadan geçmek araştırmacı için ciddi bir akademik eksiklik yaratır mı? YALNIZCA zorunlu okuma niteliğindeki tezlerde true, diğerlerinde false. 35 adayda beklenti 0-3 kabuldür.",
    },
    relevanceReasoning: {
      type: "string",
      maxLength: 180,
      description:
        "Tezin ampirik olarak neden kabul veya red edildiğine dair somut gerekçe (1-2 net cümle, maks 180 karakter)",
    },
    isDirectOverlap: {
      type: "boolean",
      description:
        "Kullanıcının tezi ile birebir örtüşme var mı (kullanıcı tezi özgün değil mi)?",
    },
    strategicRole: {
      type: "string",
      enum: [
        "SPECIFIC_FOCUS",
        "FOUNDATIONAL_WORK",
        "METHODOLOGICAL_BENCHMARK",
        "ALTERNATIVE_PERSPECTIVE",
      ],
      description:
        "Tezin stratejik rolü: SPECIFIC_FOCUS (Kısmi Odak), FOUNDATIONAL_WORK (Öncül Çalışma), METHODOLOGICAL_BENCHMARK (Yöntem Rehberi), ALTERNATIVE_PERSPECTIVE (Karşıt Yaklaşım).",
    },
    contributionAreas: {
      type: "array",
      items: { type: "string" },
      maxItems: 2,
      description:
        "Tezin kullanıcının tezine katkı sağladığı spesifik odak alanları (1-2 adet kısa etiket). İlgisiz tezlerde boş dizi [].",
    },
    literaturePosition: {
      type: "string",
      maxLength: 120,
      description:
        "Tezin literatürdeki konumu ve ne yaptığı (1 net cümle, maks 120 karakter). İlgisiz tezlerde boş string.",
    },
    strategicUtility: {
      type: "string",
      maxLength: 150,
      description:
        "Tezin kullanıcının tezinde nasıl kullanılacağına ve hangi boşluğu dolduracağına dair stratejik rehber not (1 cümle, maks 150 karakter). İlgisiz tezlerde boş string.",
    },
  },
  required: [
    "externalThesisId",
    "isRelevant",
    "relevanceReasoning",
    "isDirectOverlap",
    "contributionAreas",
    "literaturePosition",
    "strategicUtility",
  ],
  additionalProperties: false,
};

/** JSON Schema for Gemini structured outputs of the batch per-thesis evaluation. */
export const batchThesisEvaluationJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    evaluations: {
      type: "array",
      items: perThesisEvaluationJsonSchema,
      description: "Batch içerisindeki her bir adayın değerlendirme sonuçları",
    },
  },
  required: ["evaluations"],
  additionalProperties: false,
};

/** A thesis paired with its per-thesis evaluation result. */
export interface EvaluatedThesis {
  thesis: SiftedThesis;
  evaluation: PerThesisEvaluation;
}

/**
 * Evaluates a batch of candidate theses against the user's thesis matrix via structured output.
 *
 * @param input - The validated positioning matrix input.
 * @param batch - The slice of candidate theses to evaluate together.
 * @param logger - Optional structured logger for pipeline events.
 * @returns Array of successfully evaluated theses in the batch.
 */
export async function evaluateBatchTheses(
  input: PositioningMatrixInput,
  batch: SiftedThesis[],
  logger?: Logger,
): Promise<EvaluatedThesis[]> {
  if (batch.length === 0) return [];

  const payload = buildPerThesisEvaluationPromptPayload(input, batch);

  const result =
    await generateGeminiStructuredContent<BatchThesisEvaluationOutput>(
      FLASH_LITE_35,
      payload.systemInstruction,
      payload.userPrompt,
      batchThesisEvaluationJsonSchema,
      logger,
      {
        zodSchema: batchThesisEvaluationSchema,
        payloadStage: "positioning_per_thesis_evaluation",
        seed: GEMINI_SEED,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        thesisMatrix: input,
        quiet: true,
      },
    );

  const evalMap = new Map<string, PerThesisEvaluation>();
  for (const ev of result.evaluations) {
    evalMap.set(String(ev.externalThesisId), ev);
  }

  const evaluatedTheses: EvaluatedThesis[] = [];
  for (let i = 0; i < batch.length; i++) {
    const thesis = batch[i];
    const evaluation =
      evalMap.get(String(thesis.id)) ?? result.evaluations[i] ?? null;

    if (evaluation) {
      evaluatedTheses.push({
        thesis,
        evaluation: {
          ...evaluation,
          externalThesisId: String(thesis.id),
        },
      });
    } else {
      logger?.warn("positioning_per_thesis_missing_in_batch_response", {
        service: "positioning",
        filePath: "src/features/positioning/per-thesis-evaluation.ts",
        data: {
          thesisId: thesis.id,
          thesisTitle: thesis.title,
        },
      });
    }
  }

  return evaluatedTheses;
}

/**
 * Evaluates a single thesis against the user's thesis matrix via the 3-stage decision chain.
 *
 * @param input - The validated positioning matrix input.
 * @param thesis - The single thesis candidate to evaluate.
 * @param logger - Optional structured logger for pipeline events.
 * @returns The structured per-thesis evaluation result.
 */
export async function evaluateSingleThesis(
  input: PositioningMatrixInput,
  thesis: SiftedThesis,
  logger?: Logger,
): Promise<PerThesisEvaluation> {
  const evaluated = await evaluateBatchTheses(input, [thesis], logger);
  if (evaluated.length === 0) {
    throw new Error(`Failed to evaluate thesis ${thesis.id}`);
  }
  return evaluated[0].evaluation;
}

/**
 * Evaluates all candidate theses in parallel batches.
 * A fixed batch size of 12 keeps the request fan-out small (3 requests for 35 theses),
 * which minimizes total wall-clock when the API serializes concurrent calls while
 * preserving per-request calibration. An explicit `batchSize` override forces a
 * different batch size for benchmarking or tuning.
 *
 * The candidate theses are always deterministically sorted by thesis ID prior to batching
 * to guarantee identical grouping and deterministic evaluation across runs.
 *
 * @param input - The validated positioning matrix input.
 * @param theses - The full list of candidate theses to evaluate.
 * @param logger - Optional structured logger for pipeline events.
 * @param options - Optional settings: fixed batchSize override.
 * @returns The evaluated theses that were successfully processed, matching deterministic order.
 */
export async function evaluateThesesInParallel(
  input: PositioningMatrixInput,
  theses: SiftedThesis[],
  logger?: Logger,
  options?: { batchSize?: number },
): Promise<EvaluatedThesis[]> {
  if (theses.length === 0) return [];

  const startTime = performance.now();

  // 1. Sort theses deterministically by thesis ID (numeric/alphanumeric order)
  const sortedTheses = [...theses].sort((a, b) =>
    String(a.id).localeCompare(String(b.id), undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );

  // 2. Fixed batch size of 12 minimizes request count (and thus serialized wall-clock)
  //    while keeping each batch within a sane output size.
  const batchSize = options?.batchSize ?? 12;

  const batches: SiftedThesis[][] = [];
  for (let i = 0; i < sortedTheses.length; i += batchSize) {
    batches.push(sortedTheses.slice(i, i + batchSize));
  }

  logger?.info("positioning_per_thesis_evaluation_start", {
    service: "positioning",
    filePath: "src/features/positioning/per-thesis-evaluation.ts",
    data: {
      total: sortedTheses.length,
      batchSize,
      batchCount: batches.length,
      mode: "batch_parallel_scheduled",
    },
  });

  const settled = await Promise.allSettled(
    batches.map((batch) => evaluateBatchTheses(input, batch, logger)),
  );

  const allEvaluated: EvaluatedThesis[] = [];

  for (let idx = 0; idx < settled.length; idx++) {
    const res = settled[idx];
    const batch = batches[idx];
    if (res.status === "fulfilled") {
      allEvaluated.push(...res.value);
    } else {
      logger?.error("positioning_per_thesis_batch_failed", {
        service: "positioning",
        filePath: "src/features/positioning/per-thesis-evaluation.ts",
        data: {
          batchIndex: idx,
          thesisIds: batch.map((t) => t.id),
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
      total: sortedTheses.length,
      batchSize,
      batchCount: batches.length,
      evaluatedCount: allEvaluated.length,
      relevantCount: allEvaluated.filter((e) => e.evaluation.isRelevant).length,
    },
  });

  return allEvaluated;
}
