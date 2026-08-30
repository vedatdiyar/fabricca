import { generateGeminiStructuredContent } from "@/core/services/ai";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import { ThinkingLevel } from "@google/genai";
import type { Logger } from "@/lib/logger";
import {
  queryDecompositionSchema,
  queryDecompositionJsonSchema,
  type QueryDecomposition,
} from "./schemas";
import { DECOMPOSITION_SYSTEM_INSTRUCTION } from "./prompts";

/**
 * Decomposes raw proposal into multi-angle search queries.
 *
 * @param proposalText - Raw proposal text.
 * @param log - Logger instance.
 * @returns Query decomposition.
 */
export async function decomposeProposalToQueries(
  proposalText: string,
  log: Logger,
): Promise<QueryDecomposition> {
  return generateGeminiStructuredContent<QueryDecomposition>(
    FLASH_LITE_35,
    DECOMPOSITION_SYSTEM_INSTRUCTION,
    `<context>\n${proposalText.slice(0, 8000)}\n</context>\nYukarıdaki tez önerisi için çok açılı arama sorgularını üret.`,
    queryDecompositionJsonSchema,
    log,
    {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      zodSchema: queryDecompositionSchema,
      seed: GEMINI_SEED,
      payloadStage: "proposal_decomposition",
      quiet: true,
    },
  );
}
