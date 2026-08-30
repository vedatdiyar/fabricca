import { ThinkingLevel } from "@google/genai";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import { generateGeminiStructuredContent } from "@/core/services/ai";
import { getGeminiKeyPool } from "@/core/services/ai/gemini-key-pool";
import type { Logger } from "@/lib/logger";
import { buildPerThesisEvaluationPromptPayload } from "../_prompts/per-thesis-evaluation.prompt";
import type { PositioningMatrixInput } from "./validation";
import type { SiftedThesis } from "./sifting";
import {
  batchThesisEvaluationSchema,
  batchThesisEvaluationJsonSchema,
  type PerThesisEvaluation,
  type BatchThesisEvaluationOutput,
} from "./analysis-schemas";

/** Combined evaluated thesis pairing the raw thesis with its LLM evaluation. */
export interface EvaluatedThesis {
  thesis: SiftedThesis;
  evaluation: PerThesisEvaluation;
}

/** Number of candidate theses evaluated in a single parallel batch call. */
const BATCH_CHUNK_SIZE = 4;

/**
 * Evaluates candidate theses in parallel batches of 4 using FLASH_LITE_35 with LOW thinking.
 * Each thesis is evaluated for relevance, direct overlap (novelty risk), strategic role,
 * literature position, and strategic utility.
 *
 * Concurrency is matched to the available API key pool size to prevent bursting a single
 * key into rate limits or server overload cooldowns.
 *
 * @param matrix - The 3-field positioning matrix.
 * @param theses - The sifted candidate theses from Qdrant & Cohere.
 * @param logger - Optional structured logger.
 * @returns Array of evaluated theses pairing metadata with AI evaluations.
 */
export async function evaluateThesesInParallel(
  matrix: PositioningMatrixInput,
  theses: SiftedThesis[],
  logger?: Logger,
): Promise<EvaluatedThesis[]> {
  if (theses.length === 0) {
    return [];
  }

  const evalStart = performance.now();

  // Divide candidate list into chunks of 4
  const chunks: SiftedThesis[][] = [];
  for (let i = 0; i < theses.length; i += BATCH_CHUNK_SIZE) {
    chunks.push(theses.slice(i, i + BATCH_CHUNK_SIZE));
  }

  const thesisById = new Map<string, SiftedThesis>(
    theses.map((t) => [String(t.id), t]),
  );

  const poolSize = Math.max(1, getGeminiKeyPool().keys.length);
  const allEvaluations: PerThesisEvaluation[] = [];

  // Execute chunks in waves matching the key pool size (1 active request per key)
  for (let i = 0; i < chunks.length; i += poolSize) {
    const chunkBatch = chunks.slice(i, i + poolSize);
    const batchResults = await Promise.all(
      chunkBatch.map(async (chunk, batchOffset) => {
        const chunkIdx = i + batchOffset;
        const payload = buildPerThesisEvaluationPromptPayload(matrix, chunk);

        try {
          const result =
            await generateGeminiStructuredContent<BatchThesisEvaluationOutput>(
              FLASH_LITE_35,
              payload.systemInstruction,
              payload.userPrompt,
              batchThesisEvaluationJsonSchema,
              logger,
              {
                zodSchema: batchThesisEvaluationSchema,
                payloadStage: `per_thesis_eval_chunk_${chunkIdx + 1}`,
                seed: GEMINI_SEED,
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                thesisMatrix: matrix,
                quiet: true,
              },
            );

          return result.evaluations;
        } catch (error) {
          logger?.error("per_thesis_eval_chunk_error", {
            data: {
              chunkIdx,
              chunkCount: chunk.length,
            },
            error,
          });

          throw new Error(
            `Aday tez değerlendirme paketi (#${chunkIdx + 1}) işlenirken hata oluştu: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }),
    );

    allEvaluations.push(...batchResults.flat());
  }

  const evaluatedTheses: EvaluatedThesis[] = [];
  for (const evaluation of allEvaluations) {
    const rawThesis = thesisById.get(String(evaluation.externalThesisId));
    if (rawThesis) {
      evaluatedTheses.push({
        thesis: rawThesis,
        evaluation,
      });
    }
  }

  const durationMs = Math.round(performance.now() - evalStart);
  logger?.success("evaluate_theses", {
    service: "gemini",
    durationMs,
    hidden: true,
    data: {
      summary: `(${theses.length} candidate theses in parallel)`,
      totalCandidates: theses.length,
      evaluatedCount: evaluatedTheses.length,
      relevantCount: evaluatedTheses.filter((e) => e.evaluation.isRelevant)
        .length,
      overlappingCount: evaluatedTheses.filter(
        (e) => e.evaluation.isDirectOverlap,
      ).length,
    },
  });

  return evaluatedTheses;
}
