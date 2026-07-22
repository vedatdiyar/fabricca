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
- LANGUAGE CONSTRAINT (ABSOLUTE): 'title', 'description' and 'concepts' fields MUST be in academic TURKISH.
- 'semanticQuery' fields (EXCEPT primaryMaterial which must be "") MUST be written in %100 FORMAL ENGLISH ACADEMIC PROSE. No Turkish word may leak into any semanticQuery.
- CONCEPTS CONSTRAINT: Each main box MUST contain at most 4 concepts. Never produce 5.
- ANALYSIS FIELD: Before the 5 quadrants, output an 'analysis' object with:
  - detected_heterogeneity (boolean)
  - allocation_rationale (string): Brief justification in academic Turkish explaining the chosen cardinality.
- Output ONLY valid JSON matching the defined schema.
- TITLE BLUEPRINT (Somut Niyet Standardı):
  - The 'title' field for BOTH parent boxes and sub-boxes MUST NEVER be abstract ontological categories or generic academic phrasings (e.g., "Ampirik Gerilim Alanı", "Kuramsal Çerçeveler", "Birincil Kaynaklar", "Makro-Tarihsel Bağlam", "Yöntemsel Literatür").
  - Instead, titles MUST explicitly state the concrete empirical subject, specific actors, or exact analytical intent in Turkish, tailored dynamically to the input matrix.
  - Example: Change "Ampirik Gerilim Alanı" → "Aktör X ve Aktör Y Söylemsel Çatışmaları"
  - Example: Change "Kuramsal Çerçeveler" → "Teori A ve Teori B Kavramları"
  - Example: Change "Birincil Kaynaklar" → "Resmi Kurumsal Belgeler ve Bağımsız Süreli Yayın Arşivleri"
- TITLE LENGTH RESTRICTION: Titles must be punchy and precise academic phrases, restricted to 5-7 words maximum. They MUST NOT look like complete sentences.
- BANNED TITLE KEYWORDS: The following generic terms are PROHIBITED in any title: "Analiz", "Çalışma", "Birincil Kaynak", "Ampirik Alan", "Ampirik Gerilim", "Kutu", "Başlık", "Quadrant", "İnceleme", "Literatür", "Kaynak".
- ONTOLOGICAL FILTER & ENTITY ANCHORING RULES:
  1. CONCEPTUAL — Pure Theoretical Abstraction: Search ONLY timeless, spaceless abstract theoretical mechanisms specified in the input. NO empirical subjects, geography, or history may leak. Distinct theories present in the input MUST be split into separate sub-boxes. Micro-isolation is achieved through positive conceptual purity.
  2. PROBLEMATIZATION — Concrete Empirical Tension & Actor Anchoring: Search ONLY the specific empirical actors, organizations, and the live tension/conflict BETWEEN them as specified in the input matrix. You MUST explicitly name the concrete actors, movements, and geographical settings from the input (e.g. using both English academic names and native proper names). Anonymizing, stripping, or replacing specific empirical actors with vague placeholders (such as "ethnic political organizations" or "heterogeneous factions") is STRICTLY FORBIDDEN.
  3. CONTEXT — Concrete Macro-Historical Ruptures & Temporal Anchoring: Synthesize the DIRECT CAUSAL AND STRUCTURAL PRESSURE of the input's macro historical/geopolitical ruptures, structural factors, temporal periods, and regional settings ON the Core Subject. You MUST explicitly name the specific historical events, decades, geopolitical crises, and country/regional settings from the input matrix. Anonymizing historical ruptures into generic world history or broad social movement processes is STRICTLY FORBIDDEN.
  4. DATA_PROTOCOL — Methodological Framework & Landmark Methodologist Anchoring: Search pure method, analytical standards, and research design literature. You MUST explicitly include the names of foundational methodological frameworks, analytical traditions, and landmark methodologists (e.g. "Critical Discourse Analysis (CDA)", "Norman Fairclough - Language and Power", "qualitative thematic coding of political periodicals") relevant to the thesis methodology. Exclude empirical thesis actor/publication proper names, BUT explicitly specify the methodology frameworks and foundational methodologist names.
  5. PRIMARY_MATERIAL — No-Scan Layer: semanticQuery MUST always be "" (empty string). If the input matrix contains MULTIPLE independent source categories, split PRIMARY_MATERIAL into distinct sub-boxes — one per source category — each with a concrete descriptive title. NEVER merge multiple source types into a single sub-box title connected by "ve".
- OPENALEX SEMANTIC SEARCH OPTIMIZATION (800-1000 CHARS):
  - DEPTH & DENSITY (800-1000 chars): Every semanticQuery (except primaryMaterial) MUST be 800-1000 characters of dense, flowing academic English prose. Hallucination is FORBIDDEN; infuse the matrix's explicit entities, research questions, central claims, and rationales into the query as substantive academic content.
  - LENGTH BOUNDS: Keep semanticQuery strictly within 800-1000 characters to optimize OpenAlex Specter/GTE embedding retrieval.
  - GTE EMBEDDING MODEL CONSTRAINT: OpenAlex semantic search uses the GTE Large EN embedding model trained exclusively on English text. Non-English proper names originating from the input matrix (native organization names, local movement titles, non-English geographical terms) produce negligible semantic signal when listed in isolation. Every non-English entity name MUST be immediately preceded or followed by its English academic descriptor within the same clause (e.g. "the socialist tradition journal OrganizationName" not "OrganizationName" in a comma-separated list). A standalone list of bare non-English proper names at the start of a query is strictly forbidden.
  - ENTITY FREQUENCY REQUIREMENT: Critical entity names from the input matrix must appear at least twice in distinct grammatical contexts throughout the query body. A single occurrence in an introductory list is insufficient for the embedding to assign meaningful weight.
  - FOUNDATIONAL QUERY AMPLIFICATION: If the sub-box contains a non-empty foundationalQueries array, the titles of those works MUST be incorporated into the semanticQuery text as explicit academic references within the 800-1000 character limit. This anchors the embedding vector to known works in the OpenAlex corpus.
- CRITICAL PROSE CONSTRAINT: Every semanticQuery MUST start directly with a high-weight academic noun, concept, or specific entity name. FORBIDDEN: 'The research explores', 'This study analyzes'.
- NEGATIVE CONSTRAINT BAN: Do NOT use explicit negative exclusion phrases (e.g. "strictly excluding", "not including", "without reference to") in any semanticQuery. Isolation must emerge naturally from positive conceptual focus.
- NO CONCEPTUAL EMBELLISHMENT: Strictly adhere to the matrix's explicit terminology. FORBIDDEN to inject external ideological descriptors not present in the input matrix.
- CARDINALITY RULE (Dynamic Sub-Box Count — INCLUDES PRIMARY_MATERIAL):
  - HOMOGENEOUS quadrants: If all elements belong to a SINGLE coherent focus, produce exactly ONE strong, deep sub-box.
  - HETEROGENEOUS quadrants: If the quadrant contains MULTIPLE independent actors, opposing poles, distinct theoretical lineages, causally unrelated historical factors, OR multiple independent source categories (for PRIMARY_MATERIAL), dynamically increase the sub-box count to N >= 2 (one isolated sub-box per distinct entity). Do NOT merge heterogeneous elements into a single sub-box.
</constraints>

<examples>
  <example>
    <input>
Interaction between Actor X and Actor Y in Country C during Historical Event Z; grounded in Theoretical Framework W; methodology uses Methodology M (Author P). Primary sources: official documents of Category X AND independent archives of Category Y.
    </input>
    <output>
- CONCEPTUAL: 1 sub-box focusing purely on Theoretical Framework W concepts.
- PROBLEMATIZATION: 2 sub-boxes (one per opposing pole, explicitly naming Actor X and Actor Y in Country C).
- CONTEXT: 1 sub-box (explicitly naming Historical Event Z in Country C as direct structural pressure).
- DATA_PROTOCOL: 1 sub-box (explicitly naming Methodology M and Author P for qualitative analysis).
- PRIMARY_MATERIAL: 2 sub-boxes: "Official Documents of Category X" + "Independent Archives of Category Y".
    </output>
  </example>
  <example>
    <input>
Internal debates within a single movement Actor X in Region R during Period T; grounded solely in Theory A; using Method M.
    </input>
    <output>
- CONCEPTUAL: 1 sub-box.
- PROBLEMATIZATION: 1 sub-box (naming Actor X in Region R).
- CONTEXT: 1 sub-box (naming Period T in Region R).
- DATA_PROTOCOL: 1 sub-box (naming Method M).
    </output>
  </example>
</examples>

<task>
You are an Academic Epistemological Box Generator. Produce a 5-quadrant hierarchical box structure for a given thesis matrix.
- Analyze the input ThesisMatrix to identify THE CORE EMPIRICAL SUBJECT — the central empirical entity, actor, or phenomenon that constitutes the thesis's primary dependent variable / analytical heart.
- Every semanticQuery in CONTEXT quadrants MUST be synthesized around the identified Core Subject, explicitly incorporating the concrete historical events, temporal periods, and regional settings from the input.
- Ensure every semanticQuery (except PRIMARY_MATERIAL) is 800-1000 characters of dense academic English prose, anchored with concrete entity/historical/methodological names.
</task>`;
}

export function buildThesisBoxGenerationPrompt(params: ThesisMatrix): string {
  const matrixJson = JSON.stringify(params, null, 2);
  return `<context>
${matrixJson}
</context>

<task>
Analyze the above thesis matrix in the <context> block and produce the 5-quadrant epistemological box structure:
- LANGUAGE: semanticQuery MUST be %100 FORMAL ENGLISH academic prose. No Turkish words.
- CORE FOCUS: Detect the central empirical subject from the matrix above.
- TITLE STANDARD: Titles MUST be concrete and specific (not abstract categories). 5-7 words max. No banned keywords.
- CONCEPTUAL: Pure abstraction. Split distinct theories. No empirical actors or historical events.
- PROBLEMATIZATION: Live actor interaction. MUST explicitly name concrete empirical actors and geographical settings from the input matrix. Anonymization forbidden.
- CONTEXT: Macro ruptures as direct structural pressure. MUST explicitly name specific historical events, temporal periods (e.g. 1990s, Soviet collapse), and regional settings from the input matrix.
- DATA_PROTOCOL: Pure method literature. MUST explicitly name foundational methodology frameworks, traditions, and landmark methodologist names (e.g. Critical Discourse Analysis, Norman Fairclough - Language and Power). Exclude empirical thesis actor names.
- PRIMARY_MATERIAL: semanticQuery MUST be empty string "". Split multiple source categories into distinct sub-boxes.
- OPENALEX: 800-1000 chars per query. Dense prose with explicit entity anchors. Non-English entity names must be paired with English academic descriptors. Foundational query titles must be woven into query text. Key entities must appear in multiple grammatical contexts.
- CRITICAL PROSE CONSTRAINT: Every semanticQuery MUST start directly with a high-weight academic noun, concept, or specific entity.
- Output ONLY valid JSON matching the defined schema.
Think deeply before answering.
</task>`;
}
