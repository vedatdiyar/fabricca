import type { JsonSchema } from "../gemini";

/**
 * JSON schema for single semantic-query generation.
 * Returns a single string field — the English academic paragraph.
 */
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

/**
 * System instruction for generating a single OpenAlex-optimised semantic query
 * from a box title and description. Encapsulates the "Universal Savings
 * Contract" rules so the prompt is self-contained.
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

/**
 * Build the user prompt from a single box title and description.
 *
 * @param title  - The box's Turkish (or English) title
 * @param description - The box's explanation / scope text
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
