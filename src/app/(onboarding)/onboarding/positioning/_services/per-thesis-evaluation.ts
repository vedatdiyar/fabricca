import { ThinkingLevel } from "@google/genai";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import { generateGeminiStructuredContent } from "@/core/services/ai";
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
 * @param matrix - The 3-field positioning matrix.
 * @param theses - The sifted candidate theses from Tezara & Cohere.
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
  logger?.info("per_thesis_evaluation_start", {
    service: "gemini",
    filePath:
      "src/app/(onboarding)/onboarding/positioning/_services/per-thesis-evaluation.ts",
    data: { candidateCount: theses.length, chunkSize: BATCH_CHUNK_SIZE },
  });

  // Divide candidate list into chunks of 4
  const chunks: SiftedThesis[][] = [];
  for (let i = 0; i < theses.length; i += BATCH_CHUNK_SIZE) {
    chunks.push(theses.slice(i, i + BATCH_CHUNK_SIZE));
  }

  const thesisById = new Map<string, SiftedThesis>(
    theses.map((t) => [String(t.id), t]),
  );

  // Execute all chunk evaluations in parallel
  const chunkPromises = chunks.map(async (chunk, chunkIdx) => {
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
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
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
  });

  const chunkResults = await Promise.all(chunkPromises);
  const allEvaluations = chunkResults.flat();

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

  logger?.info("per_thesis_evaluation_success", {
    service: "gemini",
    filePath:
      "src/app/(onboarding)/onboarding/positioning/_services/per-thesis-evaluation.ts",
    durationMs: performance.now() - evalStart,
    data: {
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
