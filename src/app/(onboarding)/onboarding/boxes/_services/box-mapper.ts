import type { GeminiThesisBox } from "@/lib/types";

type ThesisBoxType = GeminiThesisBox["boxType"];

/**
 * Quadrant key → production BoxType mapping (adapter) whose keys match the JSON field
 * names produced by Gemini (Phase 1 & 2 schemas) and whose order follows the canonical
 * display order: SP → TF → METHOD → PM.
 */
export const QUADRANT_MAPPING: Record<string, ThesisBoxType> = {
  subjectProblem: "SUBJECT_PROBLEM",
  theoreticalFramework: "THEORETICAL_FRAMEWORK",
  methodology: "METHODOLOGY",
  primaryMaterial: "PRIMARY_MATERIAL",
};

export interface RawSubBox {
  title: string;
  description: string;
  concepts?: string[];
  semanticQuery?: string;
}

export interface RawQuadrant {
  title: string;
  description: string;
  subBoxes: RawSubBox[];
}

export interface RawQuadrants {
  subjectProblem: RawQuadrant;
  theoreticalFramework: RawQuadrant;
  methodology: RawQuadrant;
  primaryMaterial: RawQuadrant;
}

/**
 * Converts Gemini's 4-quadrant nested output into a flat GeminiThesisBox[] structure,
 * turning each category into a parent box (parentId: null) whose subBoxes carry the
 * parent's flat array index as parentId and assigning the 'semanticQuery' value
 * directly as received from the LLM.
 *
 * @param apiResponse - The 4-quadrant nested JSON object from Gemini
 * @returns A flat GeminiThesisBox array
 */
export function mapToProductionShape(
  apiResponse: RawQuadrants,
): GeminiThesisBox[] {
  const result: GeminiThesisBox[] = [];

  for (const [category, boxType] of Object.entries(QUADRANT_MAPPING)) {
    const cat = apiResponse[category as keyof RawQuadrants];
    if (!cat?.subBoxes || cat.subBoxes.length === 0) continue;

    const parentIndex = result.length;

    result.push({
      title: cat.title,
      boxType,
      description: cat.description,
      parentId: null,
      semanticQuery: null,
      concepts: [],
    });

    for (const sub of cat.subBoxes) {
      result.push({
        title: sub.title,
        boxType,
        description: sub.description,
        parentId: parentIndex,
        semanticQuery: sub.semanticQuery ?? "",
        concepts: sub.concepts ?? [],
      });
    }
  }

  return result;
}
