import type { GeminiThesisBox } from "@/lib/types";
import { sortByBoxType } from "@/lib/box-constants";
import type { boxes } from "@/core/db/schema";

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
 * Converts Gemini's 4-quadrant nested output into a flat GeminiThesisBox[] structure.
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

/**
 * Maps raw box rows to the production GeminiThesisBox shape.
 * Pure function — no DB, no session.
 *
 * @param rows - Raw box rows from the database.
 * @returns Production-shaped boxes sorted by canonical box type order.
 */
export function rowsToGeminiBoxes(
  rows: (typeof boxes.$inferSelect)[],
): GeminiThesisBox[] {
  const parentRows = rows.filter((r) => r.parentId === null);
  const subBoxMap = new Map<number, GeminiThesisBox[]>();
  for (const r of rows) {
    if (r.parentId !== null) {
      const list = subBoxMap.get(r.parentId) ?? [];
      list.push({
        id: r.id,
        title: r.title,
        boxType: (r.boxType as GeminiThesisBox["boxType"]) ?? "SUBJECT_PROBLEM",
        description: r.description ?? "",
        parentId: r.parentId,
        semanticQuery: r.semanticQuery,
        subBoxes: undefined,
        concepts: r.concepts ?? [],
      });
      subBoxMap.set(r.parentId, list);
    }
  }
  const mappedBoxes: GeminiThesisBox[] = parentRows.map((b) => ({
    id: b.id,
    title: b.title,
    boxType: (b.boxType as GeminiThesisBox["boxType"]) ?? "SUBJECT_PROBLEM",
    description: b.description ?? "",
    parentId: null,
    semanticQuery: null,
    subBoxes: subBoxMap.get(b.id),
    concepts: b.concepts ?? [],
  }));
  return mappedBoxes.sort(sortByBoxType);
}
