import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/gemini";
import type { Logger } from "@/lib/logger";
import {
  llmSiftingSchema,
  buildLlmSiftingSystemInstruction,
  buildLlmSiftingPrompt,
} from "@/lib/prompts/llm-sifting";
import type { TezaraThesisSummary } from "@/lib/types";

/**
 * Internal response shape for the LLM sifting prompt.
 */
interface LlmSiftingResponse {
  selectedThesisIds: number[];
}

/**
 * Parameter interface matching the thesis matrix fields used for LLM sifting.
 */
export interface LlmSiftParams {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
}

/**
 * Calls Gemini 3.1 Flash Lite to select the 15 most relevant theses
 * from a deduplicated TEZARA candidate pool, using the full thesis matrix
 * for conceptual matching rather than keyword/embedding similarity.
 *
 * @param params - The thesis matrix fields (6 alan).
 * @param uniqueTheses - Deduplicated list of TEZARA thesis summaries.
 * @param log - Logger instance.
 * @returns An ordered array of up to 15 selected thesis IDs.
 */
export async function siftThesesWithLLM(
  params: LlmSiftParams,
  uniqueTheses: TezaraThesisSummary[],
  log: Logger,
): Promise<number[]> {
  log.file("llm-sifter.ts:48");
  const startTime = performance.now();

  log.info("originality_llm_sift_start", {
    service: "originality",
    data: {
      count: uniqueTheses.length,
      context: params.studyTitle,
    },
  });

  if (uniqueTheses.length === 0) {
    return [];
  }

  try {
    const thesisList = uniqueTheses.map((t) => ({
      id: t.id,
      title: t.title,
      author: t.author,
      department: t.department,
      year: t.year,
    }));

    const prompt = buildLlmSiftingPrompt(params, thesisList);
    const systemInstruction = buildLlmSiftingSystemInstruction();

    log.prompt("gemini-3.1-flash-lite (llm sifting)", prompt);

    const result = await generateStructuredContent<LlmSiftingResponse>(
      "gemini-3.1-flash-lite",
      systemInstruction,
      prompt,
      llmSiftingSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        temperature: 1.0,
        seed: 42,
      },
    );

    const rawIds = Array.isArray(result?.selectedThesisIds)
      ? result.selectedThesisIds
      : [];

    const validIds = rawIds.filter((id) =>
      uniqueTheses.some((t) => t.id === id),
    );

    const uniqueValidIds = [...new Set(validIds)];

    const topIds = uniqueValidIds.slice(0, 15);

    const durationMs = performance.now() - startTime;
    log.info("originality_llm_sift_success", {
      service: "originality",
      durationMs,
      data: {
        requested: rawIds.length,
        valid: topIds.length,
        context: params.studyTitle,
      },
    });

    return topIds;
  } catch (err) {
    log.error("originality_llm_sift_failed", {
      service: "originality",
      error: err,
      data: { context: params.studyTitle },
    });
    throw err;
  }
}
