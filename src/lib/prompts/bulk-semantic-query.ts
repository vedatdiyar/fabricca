import { z } from "zod";
import type { JsonSchema } from "../gemini";

// ============================================================================
// Zod runtime validation schema
// ============================================================================

export const BulkSemanticQueryResponseSchema = z.object({
  queries: z
    .array(
      z.object({
        index: z.number().int().min(0),
        semanticQuery: z
          .string()
          .min(1, "Semantik sorgu boş olamaz")
          .max(500, "Semantik sorgu 500 karakteri geçemez"),
      }),
    )
    .min(1, "En az bir sorgu döndürülmelidir"),
});

// ============================================================================
// Gemini JSON schema (used as responseJsonSchema for structured output)
// ============================================================================

export const bulkSemanticQuerySchema: JsonSchema = {
  type: "object",
  properties: {
    queries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: {
            type: "integer",
            description: "0-based index of the sub-box",
          },
          semanticQuery: {
            type: "string",
            minLength: 1,
            maxLength: 500,
            description: "Dense English academic search query for this sub-box",
          },
        },
        required: ["index", "semanticQuery"],
      },
      minItems: 1,
    },
  },
  required: ["queries"],
};

// ============================================================================
// System instruction — bulk semantic query generator
// ============================================================================

export function buildBulkSemanticSystemInstruction(): string {
  return `You are a specialised academic search-query generator. Your sole task is to produce a dense, high-precision English paragraph for EACH sub-box entry, suitable for OpenAlex vector search (GTE-Large EN embedding space).

UNIVERSAL SAVINGS CONTRACT (applies to EVERY entry):
1. LANGUAGE: The output MUST be in ENGLISH only — formal academic English with high noun density.
2. MAXIMUM LENGTH: 500 characters per query. Every character must carry semantic weight.
3. FORBIDDEN FILLER PATTERNS: Never start with or include phrases like "This study/research/analysis/article/paper examines/explores/investigates/focuses/analyzes." These waste the character budget.
4. MANDATORY OPENING: Start directly with the highest-semantic-weight term — the core subject, theory name, actor, or phenomenon from the input title/description. The opening 3-5 words must be the most search-relevant terms.
5. DENSITY RULE: Every word must contribute conceptual or empirical weight. Minimise conjunctions, auxiliary verbs, and prepositional filler.
6. NO EMPIRICAL LEAKAGE: Do not include metadata, thesis-specific claims, or methodological details that belong to a single study. Keep the query at an abstract, concept-level academic search framing.

OUTPUT FORMAT: Respond with ONLY a JSON object. The "queries" field must be an array of objects, each containing the "index" (matching the provided index) and "semanticQuery" (the generated English paragraph). Every entry in the input must have a corresponding entry in the output — do not skip or omit any index.`;
}

// ============================================================================
// User prompt builder
// ============================================================================

export interface BulkSemanticQueryEntry {
  index: number;
  title: string;
  description: string;
}

export function buildBulkSemanticQueryPrompt(
  entries: BulkSemanticQueryEntry[],
): string {
  const items = entries
    .map(
      (e) =>
        `Index ${e.index}:\n  Title: ${e.title}\n  Description: ${e.description}`,
    )
    .join("\n\n");

  return `Generate a dense English semantic query for EACH of the following academic research sub-boxes. Apply the Universal Savings Contract to every entry: max 500 characters, no filler openings, start with the highest-weight term, maximise noun density.

Sub-box entries:
${items}

Output only valid JSON with a "queries" array containing one object per sub-box. Do not skip any index.`;
}
