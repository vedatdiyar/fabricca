import { z } from "zod";
import type { JsonSchema } from "../gemini";

// ============================================================================
// Zod runtime validation schema
// ============================================================================

export const SemanticQueryResponseSchema = z.object({
  semanticQuery: z
    .string()
    .min(1, "Semantik sorgu boş olamaz")
    .max(500, "Semantik sorgu 500 karakteri geçemez"),
});

// ============================================================================
// Gemini JSON schema (used as responseJsonSchema for structured output)
// ============================================================================

export const semanticQuerySchema: JsonSchema = {
  type: "object",
  properties: {
    semanticQuery: {
      type: "string",
      minLength: 1,
      maxLength: 500,
    },
  },
  required: ["semanticQuery"],
};

// ============================================================================
// System instruction — production-ready semantic query generator
// ============================================================================

/**
 * Returns a self-contained system instruction that drives Gemini to generate
 * a dense, high-precision English academic paragraph suitable for OpenAlex
 * vector search (GTE-Large EN embedding space).
 */
export function buildStandaloneSemanticQuerySystemInstruction(): string {
  return `You are a specialised academic search-query generator. Your sole task is to produce a dense, high-precision English paragraph suitable for OpenAlex vector search (GTE-Large EN embedding space).

UNIVERSAL SAVINGS CONTRACT:
1. LANGUAGE: The output MUST be in ENGLISH only — formal academic English with high noun density.
2. MAXIMUM LENGTH: 500 characters. Every character must carry semantic weight.
3. FORBIDDEN FILLER PATTERNS: Never start with or include phrases like "This study/research/analysis/article/paper examines/explores/investigates/focuses/analyzes." These waste the character budget.
4. MANDATORY OPENING: Start directly with the highest-semantic-weight term — the core subject, theory name, actor, or phenomenon from the input title/description. The opening 3-5 words must be the most search-relevant terms.
5. DENSITY RULE: Every word must contribute conceptual or empirical weight. Minimise conjunctions, auxiliary verbs, and prepositional filler.
6. NO EMPIRICAL LEAKAGE: Do not include metadata, thesis-specific claims, or methodological details that belong to a single study. Keep the query at an abstract, concept-level academic search framing.
7. OUTPUT FORMAT: Respond with ONLY a JSON object containing a single field "semanticQuery" whose value is the generated English paragraph.`;
}

// ============================================================================
// User prompt builder
// ============================================================================

/**
 * Builds the user-facing prompt for a single box.
 *
 * @param title       - The box's title (e.g. "Çerçeveleme Teorisi")
 * @param description - The box's scope / explanation text
 * @returns The prompt string to send to Gemini
 */
export function buildSemanticQueryPrompt(
  title: string,
  description: string,
): string {
  return `Generate a dense English semantic query for the following academic research box:

Box Title: ${title}
Box Description: ${description}

Apply the Universal Savings Contract: max 500 characters, no filler openings, start with the highest-weight term, maximise noun density. Output only valid JSON with a single "semanticQuery" field.`;
}
