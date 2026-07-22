import { z } from "zod";
import type { JsonSchema, JsonSchemaProperty } from "../services/gemini";
import type { ThesisMatrix } from "../types";

const subBoxSchema = z.object({
  title: z.string(),
  description: z.string(),
  semanticQuery: z
    .string()
    .describe(
      "Must be empty string for primaryMaterial. For others, must be formal English academic prose, heavily anchored or purely theoretical based on the quadrant.",
    ),
  foundationalQueries: z
    .array(
      z.object({
        author: z.string(),
        title: z.string(),
        publicationYear: z.number(),
      }),
    )
    .optional()
    .default([]),
});

const quadrantSchema = z.object({
  title: z.string(),
  description: z.string(),
  concepts: z
    .array(z.string())
    .max(4)
    .describe("At most 4 concepts allowed. Never output 5."),
  subBoxes: z
    .array(subBoxSchema)
    .min(1)
    .describe("Dynamically 1 for homogeneous, N>=2 for heterogeneous targets."),
});

export const thesisBoxGenerationSchema = z.object({
  analysis: z.object({
    detected_heterogeneity: z.boolean(),
    allocation_rationale: z
      .string()
      .describe(
        "Justification in Turkish for the chosen sub-box counts across all quadrants.",
      ),
  }),
  conceptual: quadrantSchema,
  problematization: quadrantSchema,
  context: quadrantSchema,
  dataProtocol: quadrantSchema,
  primaryMaterial: quadrantSchema,
});

export type RawNestedResponse = z.infer<typeof thesisBoxGenerationSchema>;

function buildQuadrantJsonSchema(): JsonSchemaProperty {
  return {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      concepts: {
        type: "array",
        items: { type: "string" },
        maxItems: 4,
      },
      subBoxes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            semanticQuery: { type: "string" },
            foundationalQueries: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  author: { type: "string" },
                  title: { type: "string" },
                  publicationYear: { type: "number" },
                },
              },
            },
          },
          required: ["title", "description", "semanticQuery"],
        },
      },
    },
    required: ["title", "description", "concepts", "subBoxes"],
  };
}

export const thesisBoxGenerationJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    analysis: {
      type: "object",
      properties: {
        detected_heterogeneity: { type: "boolean" },
        allocation_rationale: { type: "string" },
      },
      required: ["detected_heterogeneity", "allocation_rationale"],
    },
    conceptual: buildQuadrantJsonSchema(),
    problematization: buildQuadrantJsonSchema(),
    context: buildQuadrantJsonSchema(),
    dataProtocol: buildQuadrantJsonSchema(),
    primaryMaterial: buildQuadrantJsonSchema(),
  },
  required: [
    "analysis",
    "conceptual",
    "problematization",
    "primaryMaterial",
    "context",
    "dataProtocol",
  ],
};

export function buildThesisBoxGenerationSystemInstruction(): string {
  return `<constraints>
- LANGUAGE: title/description/concepts in academic TURKISH; semanticQuery in %100 ENGLISH academic prose. No language mixing.
- 5 QUADRANT ISOLATION — each quadrant's semanticQuery MUST be ontologically pure:
  1. CONCEPTUAL: Pure theoretical abstraction. NO empirical actors, geography, or history. Split distinct theories into separate sub-boxes.
  2. PROBLEMATIZATION: Concrete empirical actors + live tension BETWEEN them. Native proper nouns STRICTLY FORBIDDEN in semanticQuery — use ONLY English academic category names (e.g. "Marxist-Leninist factions in Country C"). Do NOT anonymize into vague placeholders. Geographical anchoring: MUST include country/region in English. Grammatical subject: THIS sub-box's actors MUST be the subject of dominant clauses; actors from other sub-boxes ONLY in dependent clauses.
  3. CONTEXT: Macro-historical ruptures as structural pressure on the core subject. MUST explicitly name specific events, periods, and regional settings from the input.
  4. DATA_PROTOCOL: Pure methodology. MUST name frameworks, traditions, and landmark methodologist names. Exclude empirical thesis actor names.
  5. PRIMARY_MATERIAL: semanticQuery = "". Split multiple source categories into distinct sub-boxes.
- semanticQuery: 800-1000 characters of dense prose. Start directly with a substantive noun/concept. Forbidden: "The research explores", "This study analyzes". No negative exclusion phrases — isolation through positive focus.
- TITLES: Concrete empirical intent, 5-7 words max. Banned: "Analiz", "Çalışma", "Ampirik", "Kutu", "Literatür", "Kaynak", "Birincil Kaynak", "Başlık", "Quadrant", "İnceleme".
- SUB-BOX COUNT: homogeneous → 1; heterogeneous → N>=2 (one per distinct entity). Max 4 concepts per quadrant.
- Adhere strictly to the input matrix terminology. NO external ideological embellishment.
- Output ONLY valid JSON matching the schema.
</constraints>

<examples>
  <example>
    <input>
Interaction between Actor X and Actor Y in Country C during Event Z; Theory W; Method M (Author P). Sources: docs Cat X + archives Cat Y.
    </input>
    <output>
- CONCEPTUAL: 1 sub-box → Theory W concepts.
- PROBLEMATIZATION: 2 sub-boxes → Actor X pole, Actor Y pole in Country C.
- CONTEXT: 1 sub-box → Event Z in Country C.
- DATA_PROTOCOL: 1 sub-box → Method M (Author P).
- PRIMARY_MATERIAL: 2 sub-boxes → "Official Docs of Category X" + "Independent Archives of Category Y".
    </output>
  </example>
</examples>`;
}

export function buildThesisBoxGenerationPrompt(params: ThesisMatrix): string {
  const matrixJson = JSON.stringify(params, null, 2);
  return `<context>
${matrixJson}
</context>

<task>
Analyze the matrix above and produce the 5-quadrant epistemological box structure following the constraints and example.

Key rule for PROBLEMATIZATION: This sub-box's empirical actors MUST be the grammatical subject of dominant clauses; other actors from the input appear ONLY in dependent clauses.
</task>`;
}
