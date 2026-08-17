import type { FunctionDeclaration } from "@google/genai";
import { READ_TOOL_DECLARATIONS } from "./read-declarations";
import { MUTATION_TOOL_DECLARATIONS } from "./mutation-declarations";

export { READ_TOOL_DECLARATIONS, MUTATION_TOOL_DECLARATIONS };
export * from "./read-tools";
export * from "./mutation-tools";
export * from "./undo-tools";

/** List of all Gemini Function Declarations for the Thesis Advisor Chat. */
export const ADVISOR_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  ...READ_TOOL_DECLARATIONS,
  ...MUTATION_TOOL_DECLARATIONS,
];