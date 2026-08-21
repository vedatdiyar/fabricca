import { generateGeminiStructuredContent } from "@/core/services/ai";
import { FLASH_36 } from "@/lib/constants";
import {
  buildCitationSynthesisPromptPayload,
  citationSynthesisJsonSchema,
  type CitationSynthesisPromptInput,
} from "../_prompts/citation-synthesis.prompt";

export interface SemanticClusterItem {
  id: string;
  themeTitle: string;
  description: string;
  cardIds: number[];
  suggestedOutlineId?: number;
  suggestedOutlineTitle?: string;
}

export interface ArgumentFlowStep {
  step: number;
  cardId: number;
  roleInArgument: string;
  transitionNote: string;
}

export interface CitationSynthesisReport {
  clusters: SemanticClusterItem[];
  argumentFlow: ArgumentFlowStep[];
}

/**
 * Runs AI Citation Synthesis to generate thematic clusters and step-by-step argument flow for Word.
 *
 * @param input - Citation cards and Outlines data.
 * @returns Structured synthesis report.
 */
export async function runCitationSynthesis(
  input: CitationSynthesisPromptInput,
): Promise<CitationSynthesisReport> {
  const payload = buildCitationSynthesisPromptPayload(input);

  const report = await generateGeminiStructuredContent<CitationSynthesisReport>(
    FLASH_36,
    payload.systemInstruction,
    payload.userPrompt,
    citationSynthesisJsonSchema,
    undefined,
    {
      payloadStage: "citation_synthesis_organizer",
    },
  );

  return report;
}
