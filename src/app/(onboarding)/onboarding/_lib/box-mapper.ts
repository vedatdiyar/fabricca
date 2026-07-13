import { type RawNestedResponse } from "@/lib/prompts/box-generation";
import type { GeminiThesisBox } from "@/lib/types";

type ThesisBoxType = GeminiThesisBox["boxType"];

/**
 * Quadrant key → production BoxType mapping (adapter).
 */
export const QUADRANT_MAPPING: Record<string, ThesisBoxType> = {
  conceptual: "CONCEPTUAL",
  problematization: "PROBLEMATIZATION",
  primaryMaterial: "PRIMARY_MATERIAL",
  context: "CONTEXT",
  dataProtocol: "DATA_PROTOCOL",
};

export type RawQuadrants = Omit<RawNestedResponse, "analysis">;

/**
 * Converts Gemini's 5-quadrant nested output into a flat GeminiThesisBox[]
 * structure. Each category becomes a parent box (parentId: null); its subBoxes
 * carry the parent's flat array index as parentId.
 * The 'semanticQuery' value is assigned directly as received from the LLM.
 *
 * @param apiResponse - The 5-quadrant nested JSON object from Gemini
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
      concepts: cat.concepts ?? [],
      foundationalQueries: [],
    });

    for (const sub of cat.subBoxes) {
      result.push({
        title: sub.title,
        boxType,
        description: sub.description,
        parentId: parentIndex,
        semanticQuery: sub.semanticQuery ?? "",
        foundationalQueries: [],
      });
    }
  }

  return result;
}
