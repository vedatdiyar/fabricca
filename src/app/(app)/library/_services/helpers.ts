import type { ThesisBoxType } from "../_types/types";

/** Helper to provide default titles for thesis box types */
export function getBoxDefaultTitle(boxType: Exclude<ThesisBoxType, "ALL">) {
  switch (boxType) {
    case "THEORETICAL_FRAMEWORK":
      return "Kuramsal Çerçeve";
    case "METHODOLOGY":
      return "Metodoloji";
    case "SUBJECT_PROBLEM":
      return "Konu ve Problem";
    case "PRIMARY_MATERIAL":
      return "Birincil Malzeme";
  }
}
