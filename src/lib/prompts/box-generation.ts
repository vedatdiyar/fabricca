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
- ABSOLUTE SUB-BOX ISOLATION — each sub-box query is COMPLETELY ISOLATED from every other sub-box. A query for sub-box A must NEVER reference concepts, actors, or events that belong to sub-box B, C, D, or E. Each sub-box is its own sealed ontological container.

1. CONCEPTUAL: PURE THEORY ONLY. Zero empirical references. Forbidden in query: country names, person names, party names, event names, geographic terms, period names. Each sub-box query must focus on ONE specific theory and ONLY that theory — no merging distinct theories.

2. PROBLEMATIZATION: Concrete empirical actors + live tension BETWEEN them. ZERO native proper nouns in semanticQuery. Forbidden: any specific party name, publication name, person name, organization name. Use ONLY English academic category names WITH geographical anchoring (country/region required alongside the category, e.g. "Kurdish political movement in Turkey" is valid, but "Ethnonationalist political movements" alone is too vague). ACTOR FIDELITY: The sub-box title determines THIS sub-box's actor — that actor MUST be the grammatical SUBJECT of dominant clauses.

3. CONTEXT: Macro-historical ruptures as structural pressure. Name the specific event/period WITH geographical anchoring in the opening 5 words. Do NOT start with a generic phrase.

4. DATA_PROTOCOL: Pure methodology. MUST name frameworks, traditions, landmark methodologist names. Zero thesis-specific actor names.

5. PRIMARY_MATERIAL: semanticQuery = "". Split multiple source categories into distinct sub-boxes.

- semanticQuery: MAXIMUM 1000 characters. Start directly with a substantive noun/concept. Forbidden openings: "The research explores", "This study analyzes", "This paper", "The article", "Macro-structural". Each query is ONE sub-box's concept ONLY — no merging.
- TITLES: Concrete empirical intent, 5-7 words max. Banned: "Analiz", "Calisma", "Ampirik", "Kutu", "Literatur", "Kaynak", "Birincil Kaynak", "Baslik", "Quadrant", "Inceleme".
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

CRITICAL — ABSOLUTE SUB-BOX ISOLATION: Each sub-box query must ONLY contain concepts belonging to THAT sub-box. Zero cross-sub-box contamination. No merging distinct theories in CONCEPTUAL. No swapping actors in PROBLEMATIZATION. No generic openings in CONTEXT.
</task>`;
}
