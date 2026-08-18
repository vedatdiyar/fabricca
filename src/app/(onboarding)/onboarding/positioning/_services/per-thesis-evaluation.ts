import { z } from "zod";
import { ThinkingLevel } from "@google/genai";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import {
  generateGeminiStructuredContent,
  type JsonSchema,
} from "@/core/services/ai";
import type { Logger } from "@/lib/logger";
import { buildBinaryTriagePromptPayload } from "../_prompts/binary-triage.prompt";
import { buildPerThesisEvaluationPromptPayload } from "../_prompts/per-thesis-evaluation.prompt";
import { strategicRoleEnum, type PositioningMatrixInput } from "./validation";
import type { SiftedThesis } from "./sifting";
import {
  binaryTriageOutputSchema,
  binaryTriageJsonSchema,
  type BinaryTriageOutput,
} from "./analysis-schemas";

/** Zod schema for the single-thesis strategic relevance/originality/role evaluation output. */
export const perThesisEvaluationSchema = z.object({
  externalThesisId: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .describe("Değerlendirilen tezin ID'si"),
  isRelevant: z
    .boolean()
    .describe(
      "Aday tez kullanıcının 3 bileşenli tez matrisi (Problem, Kuram, Yöntem) için doğrudan kuramsal, yöntemsel veya ampirik birincil muhatap mıdır?",
    ),
  relevanceReasoning: z
    .string()
    .optional()
    .describe(
      "Tezin ampirik olarak neden ilgili olduğuna dair somut gerekçe (1-2 cümle)",
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
        "Aday tez kullanıcının 3 bileşenli tez matrisi için doğrudan kuramsal, yöntemsel veya ampirik birincil muhatap mıdır?",
    },
    relevanceReasoning: {
      type: "string",
      maxLength: 180,
      description:
        "Tezin ampirik olarak neden kabul edildiğine dair somut gerekçe (1-2 net cümle, maks 180 karakter)",
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
        "Tezin kullanıcının tezine katkı sağladığı spesifik odak alanları (1-2 adet kısa etiket).",
    },
    literaturePosition: {
      type: "string",
      maxLength: 120,
      description:
        "Tezin literatürdeki konumu ve ne yaptığı (1 net cümle, maks 120 karakter).",
    },
    strategicUtility: {
      type: "string",
      maxLength: 180,
      description:
        "Tezin kullanıcının tezinde nasıl kullanılacağına ve hangi boşluğu dolduracağına dair stratejik rehber not (1-2 cümle, maks 180 karakter).",
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

/** JSON Schema for Gemini structured outputs of the batch per-thesis evaluation. */
export const batchThesisEvaluationJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    evaluations: {
      type: "array",
      items: perThesisEvaluationJsonSchema,
      description: "Ön elemeden geçen kilit tezlerin stratejik profilleme sonuçları",
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
 * Runs Stage 1 binary triage across candidate theses in parallel batches.
 *
 * @param input - The validated positioning matrix input.
 * @param batch - The candidate theses to screen.
 * @param logger - Optional structured logger.
 * @returns Array of candidate theses that passed the triage with isRelevant true.
 */
async function triageBatchTheses(
  input: PositioningMatrixInput,
  batch: SiftedThesis[],
  logger?: Logger,
): Promise<{ passedTheses: SiftedThesis[]; reasonByThesisId: Map<string, string> }> {
  if (batch.length === 0) {
    return { passedTheses: [], reasonByThesisId: new Map() };
  }

  const payload = buildBinaryTriagePromptPayload(input, batch);

  const result =
    await generateGeminiStructuredContent<BinaryTriageOutput>(
      FLASH_LITE_35,
      payload.systemInstruction,
      payload.userPrompt,
      binaryTriageJsonSchema,
      logger,
      {
        zodSchema: binaryTriageOutputSchema,
        payloadStage: "positioning_binary_triage",
        seed: GEMINI_SEED,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        thesisMatrix: input,
        quiet: true,
      },
    );

  const evalMap = new Map<string, { isRelevant: boolean; decisionReason: string }>();
  for (const ev of result.evaluations) {
    evalMap.set(String(ev.externalThesisId), {
      isRelevant: ev.isRelevant,
      decisionReason: ev.decisionReason,
    });
  }

  const passedTheses: SiftedThesis[] = [];
  const reasonByThesisId = new Map<string, string>();

  for (let i = 0; i < batch.length; i++) {
    const thesis = batch[i];
    const evaluation =
      evalMap.get(String(thesis.id)) ?? result.evaluations[i] ?? null;

    if (evaluation?.isRelevant) {
      passedTheses.push(thesis);
      if (evaluation.decisionReason) {
        reasonByThesisId.set(String(thesis.id), evaluation.decisionReason);
      }
    }
  }

  return { passedTheses, reasonByThesisId };
}

/**
 * Evaluates a batch of pre-screened relevant candidate theses to produce detailed strategic profiles.
 *
 * @param input - The validated positioning matrix input.
 * @param batch - The slice of relevant candidate theses to profile together.
 * @param reasonsMap - Optional map of pre-screened triage reasons.
 * @param logger - Optional structured logger for pipeline events.
 * @returns Array of successfully evaluated theses in the batch.
 */
export async function evaluateBatchTheses(
  input: PositioningMatrixInput,
  batch: SiftedThesis[],
  reasonsMap?: Map<string, string>,
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
        payloadStage: "positioning_deep_profiling",
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
          isRelevant: true,
          relevanceReasoning:
            evaluation.relevanceReasoning ||
            reasonsMap?.get(String(thesis.id)) ||
            undefined,
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
 * Evaluates a single thesis against the user's thesis matrix via the 2-stage decision chain.
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
  const evaluated = await evaluateBatchTheses(input, [thesis], undefined, logger);
  if (evaluated.length === 0) {
    throw new Error(`Failed to evaluate thesis ${thesis.id}`);
  }
  return evaluated[0].evaluation;
}

/**
 * Evaluates all candidate theses in a 2-stage pipeline:
 * Stage 1: Coarse-grained domain-agnostic binary triage across all candidate theses.
 * Stage 2: Fine-grained deep strategic profiling on the surviving relevant candidates.
 *
 * @param input - The validated positioning matrix input.
 * @param theses - The full list of candidate theses to evaluate.
 * @param logger - Optional structured logger for pipeline events.
 * @param options - Optional settings: fixed batchSize override for triage.
 * @returns The evaluated theses that passed triage and were profiled.
 */
export async function evaluateThesesInParallel(
  input: PositioningMatrixInput,
  theses: SiftedThesis[],
  logger?: Logger,
  options?: { batchSize?: number },
): Promise<EvaluatedThesis[]> {
  if (theses.length === 0) return [];

  const startTime = performance.now();

  // 1. Sort theses deterministically by thesis ID
  const sortedTheses = [...theses].sort((a, b) =>
    String(a.id).localeCompare(String(b.id), undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );

  // 2. Stage 1: Batch Binary Triage across candidates
  const triageBatchSize = options?.batchSize ?? 18;
  const triageBatches: SiftedThesis[][] = [];
  for (let i = 0; i < sortedTheses.length; i += triageBatchSize) {
    triageBatches.push(sortedTheses.slice(i, i + triageBatchSize));
  }

  logger?.info("positioning_binary_triage_start", {
    service: "positioning",
    filePath: "src/features/positioning/per-thesis-evaluation.ts",
    data: {
      total: sortedTheses.length,
      batchSize: triageBatchSize,
      batchCount: triageBatches.length,
    },
  });

  const triageSettled = await Promise.allSettled(
    triageBatches.map((batch) => triageBatchTheses(input, batch, logger)),
  );

  const survivingTheses: SiftedThesis[] = [];
  const triageReasons = new Map<string, string>();

  for (let idx = 0; idx < triageSettled.length; idx++) {
    const res = triageSettled[idx];
    if (res.status === "fulfilled") {
      survivingTheses.push(...res.value.passedTheses);
      for (const [id, reason] of res.value.reasonByThesisId.entries()) {
        triageReasons.set(id, reason);
      }
    } else {
      logger?.error("positioning_binary_triage_batch_failed", {
        service: "positioning",
        filePath: "src/features/positioning/per-thesis-evaluation.ts",
        data: {
          batchIndex: idx,
        },
        error: res.reason,
      });
    }
  }

  logger?.info("positioning_binary_triage_success", {
    service: "positioning",
    filePath: "src/features/positioning/per-thesis-evaluation.ts",
    durationMs: Math.round(performance.now() - startTime),
    data: {
      totalCandidates: sortedTheses.length,
      survivingCount: survivingTheses.length,
    },
  });

  if (survivingTheses.length === 0) {
    return [];
  }

  // 3. Stage 2: Deep Strategic Profiling on surviving theses
  const profileStart = performance.now();
  logger?.info("positioning_deep_profiling_start", {
    service: "positioning",
    filePath: "src/features/positioning/per-thesis-evaluation.ts",
    data: {
      survivingCount: survivingTheses.length,
    },
  });

  const profiledTheses = await evaluateBatchTheses(
    input,
    survivingTheses,
    triageReasons,
    logger,
  );

  logger?.info("positioning_deep_profiling_success", {
    service: "positioning",
    filePath: "src/features/positioning/per-thesis-evaluation.ts",
    durationMs: Math.round(performance.now() - profileStart),
    data: {
      profiledCount: profiledTheses.length,
      totalDurationMs: Math.round(performance.now() - startTime),
    },
  });

  return profiledTheses;
}
