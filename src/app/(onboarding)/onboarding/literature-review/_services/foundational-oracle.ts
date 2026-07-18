import {
  generateStructuredContent,
  type JsonSchema,
} from "@/lib/services/gemini";
import { GEMINI_MODEL, GEMINI_TEMPERATURE, GEMINI_SEED } from "@/lib/constants";
import { ThinkingLevel } from "@google/genai";
import { Logger } from "@/lib/logger";
import { z } from "zod";

export interface CandidateWork {
  title: string;
  authors: string;
  year: number | null;
  openAlexId: string;
  doi: string | null;
  publisher: string | null;
}

export interface BulkSelectionResult {
  selections: {
    subBoxTitle: string;
    selectedIndex: number;
    reasoning: string;
  }[];
}

const bulkSelectSchema: JsonSchema = {
  type: "object",
  properties: {
    selections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          subBoxTitle: { type: "string" },
          selectedIndex: {
            type: "integer",
            description:
              "Selected candidate index (0-based) from that sub-box candidates list",
          },
          reasoning: {
            type: "string",
            description:
              "Brief reasoning in Turkish explaining the choice (shown to the user in the UI).",
          },
        },
        required: ["subBoxTitle", "selectedIndex", "reasoning"],
      },
    },
  },
  required: ["selections"],
};

const zodBulkSelectSchema = z.object({
  selections: z.array(
    z.object({
      subBoxTitle: z.string(),
      selectedIndex: z.number().int().min(0),
      reasoning: z.string().min(1),
    }),
  ),
});

const BULK_FOUNDATIONAL_JURY_PROMPT = `<constraints>
Selection Rules (Box Type Based Strategy):
1. If box type is "CONCEPTUAL": Select the primary original theoretical source that establishes/introduces the theoretical framework or concept mentioned in the box title or description. Do NOT under ANY circumstances select secondary interpretations, critiques, revisionist theories, or applied studies when the original primary work of the theory's creator is among the candidates. The primary foundational text always takes absolute precedence.
2. If box type is "PROBLEMATIZATION", "CONTEXT" or "DATA_PROTOCOL": Prefer empirical studies, field research, historical analyses, or methodological landmarks that directly overlap with the box title and description. Do NOT under any circumstances select broad, abstract theoretical works (e.g. general discourse theory, general hegemony theory, general social protest theory) for these boxes, even if they match keywords. These boxes require works that are empirically, historically, or geographically grounded in the specific context described (e.g. Turkey, Kurdish conflict, Turkish left).
3. LANGUAGE PREFERENCE: Prefer works written in English or Turkish. Avoid selecting works in French, German, or other languages unless they are the absolute primary original text for a CONCEPTUAL framework and no English/Turkish translation or version is available in the candidates.
4. GLOBAL STRICT SEQUENTIAL DEDUPLICATION:
   Process selections sequentially in order (Sub-Box [0] -> Sub-Box [1] -> Sub-Box [2]...).
   When selecting for a sub-box, check titles selected for all PREVIOUS sub-boxes. Under NO circumstances select a work that was already chosen for a prior sub-box, even if it appears in the current sub-box's candidate list. Ensure every sub-box gets a unique work.
5. Output format: For each sub-box, return the sub-box title (subBoxTitle), the 0-based index of the selected candidate (selectedIndex), and a reasoning string in Turkish (Türkçe gerekçe) explaining the choice.
</constraints>

<task>
You are an expert academic committee member and auditor. Given the thesis sub-box context below, select the most appropriate single "Foundational Work" from each sub-box's candidate list according to the constraints above. Perform the selection for all sub-boxes simultaneously to enable global deduplication.
</task>`;

/**
 * Calls Gemini to select the most appropriate foundational work for
 * multiple sub-boxes simultaneously. Uses temperature 1.0 and
 * ThinkingLevel.LOW for optimized performance and global deduplication.
 *
 * @param subBoxes - List of sub-boxes along with their compiled candidates
 * @param logger - Optional Logger instance for structured LLM call logging
 * @returns Object mapping each sub-box title to its selected candidate
 *          index and selection reasoning (in Turkish for UI display)
 */
export async function selectFoundationalWorksBulk(
  subBoxes: {
    title: string;
    boxType: string;
    description: string;
    candidates: CandidateWork[];
  }[],
  logger?: Logger,
): Promise<BulkSelectionResult> {
  if (subBoxes.length === 0) {
    return { selections: [] };
  }

  const promptParts = subBoxes
    .map((subBox, sbIdx) => {
      return `Sub-Box [${sbIdx}]:
Title: ${subBox.title}
Box Type: ${subBox.boxType}
Description: ${subBox.description ?? ""}

Candidate Works:
${subBox.candidates.map((c, idx) => `${idx}. [${c.year}] "${c.title}" - Author(s): ${c.authors}`).join("\n")}
`;
    })
    .join("\n---\n\n");

  const prompt = `<context>
${promptParts}
</context>

<task>
For each sub-box in the <context> block above, select the most appropriate foundational work according to the selection rules. Think step by step before answering. Output the result as JSON following the required schema.
</task>`;

  const result = await generateStructuredContent<BulkSelectionResult>(
    GEMINI_MODEL,
    BULK_FOUNDATIONAL_JURY_PROMPT,
    prompt,
    bulkSelectSchema,
    logger,
    {
      temperature: GEMINI_TEMPERATURE,
      seed: GEMINI_SEED,
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
      zodSchema: zodBulkSelectSchema,
      payloadStage: "literature_bulk_foundational_selection",
      quiet: true,
    },
  );

  return result;
}
