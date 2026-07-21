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
- ONTOLOGICAL FILTER RULES:
  1. CONCEPTUAL — Pure Theoretical Abstraction: Search ONLY timeless, spaceless abstract theoretical mechanisms. NO empirical subjects, geography, or history may leak. Distinct theories present in the input MUST be split into separate sub-boxes; they must never bleed into each other. Micro-isolation is achieved through positive conceptual purity, not negative exclusion phrases.
  2. PROBLEMATIZATION — Empirical Tension Zone: Search ONLY the empirical actors and the live tension/conflict BETWEEN them as specified in the input matrix. NO theorist names or abstract concept definitions may leak here. All local/native proper names (actors, publications, organizations) MUST be accompanied by universal academic descriptors explaining their nature.
  3. CONTEXT — Macro-Historical Rupture on the Core Subject: Synthesize the DIRECT CAUSAL AND STRUCTURAL PRESSURE of the input's macro historical/geopolitical ruptures (e.g., the post-Cold War transition, collapse of political current Z) and structural factors ON the Core Subject, anchored specifically to the 'context' field provided in the input matrix. The query must lock onto this regional and temporal setting to avoid generic world history or unrelated international relations literature.
  4. DATA_PROTOCOL — Pure Methodological Literature: Search ONLY pure method, analytical standards, and research design literature. You MUST specify the generic medium of application (e.g., "qualitative comparative discourse analysis of political periodicals, party publications, and social movement journals") to retrieve highly relevant methodological standards. However, you MUST NOT include any specific proper names of the actors or publications of the thesis (such as specific party or journal names) to prevent the query from turning into an empirical search.
  5. PRIMARY_MATERIAL — No-Scan Layer: semanticQuery MUST always be "" (empty string). If the input matrix contains MULTIPLE independent source categories (e.g., official legal party documents AND independent journal archives), the LLM MUST split PRIMARY_MATERIAL into distinct sub-boxes — one per source category — each with a concrete descriptive title. NEVER merge multiple source types into a single sub-box title connected by "ve".
- OPENALEX SEMANTIC SEARCH OPTIMIZATION:
  - DEPTH & DENSITY (800-1000 chars): Every semanticQuery (except primaryMaterial) MUST be 800-1000 characters of dense, flowing academic English prose. Hallucination is FORBIDDEN; instead, infuse the matrix's research questions, central claims, and rationales into the query as substantive academic content.
  - MAX UPPER BOUND: Never exceed 1000 characters.
  - CONCEPTUAL QUALIFIERS: When local/native proper nouns (actors, journals, organizations from the input) appear in PROBLEMATIZATION or CONTEXT sub-box queries, they MUST be immediately followed by universal academic descriptors explaining what they are. The GTE Large EN embedding model cannot resolve bare native names.
- CRITICAL PROSE CONSTRAINT: Every semanticQuery MUST start directly with a high-weight academic noun or concept. FORBIDDEN: 'The research explores', 'This study analyzes'.
- NEGATIVE CONSTRAINT BAN: Do NOT use explicit negative exclusion phrases (e.g. "strictly excluding", "not including", "without reference to") in any semanticQuery. Isolation must emerge naturally from positive conceptual focus.
- NO CONCEPTUAL EMBELLISHMENT: Strictly adhere to the matrix's explicit terminology. FORBIDDEN to inject external ideological descriptors.
- CARDINALITY RULE (Dynamic Sub-Box Count — INCLUDES PRIMARY_MATERIAL):
  - HOMOGENEOUS quadrants: If all elements belong to a SINGLE coherent focus, produce exactly ONE strong, deep sub-box.
  - HETEROGENEOUS quadrants: If the quadrant contains MULTIPLE independent actors, opposing poles, distinct theoretical lineages, causally unrelated historical factors, OR multiple independent source categories (for PRIMARY_MATERIAL), dynamically increase the sub-box count to N >= 2 (one isolated sub-box per distinct entity). Do NOT merge heterogeneous elements into a single sub-box.
  - PRIMARY_MATERIAL HETEROGENEITY RULE: If the input includes distinct source categories (e.g., party congress documents AND newspaper archives AND journal publications), create one sub-box per source category with a concrete descriptive title. NEVER merge them under a single "ve" conjunction.
</constraints>

<examples>
  <example>
    <input>
Interaction between Actor X and Actor Y; historical event Z and socio-economic process W as distinct contextual forces; drawing on Theory A AND Theory B. Primary sources: official documents of Category X AND independent archives of Category Y.
    </input>
    <output>
- CONCEPTUAL: 2 sub-boxes (one per theory).
- PROBLEMATIZATION: 2 sub-boxes (one per opposing pole).
- CONTEXT: 2 sub-boxes (historical event Z and socio-economic process W as separate causal ruptures).
- PRIMARY_MATERIAL: 2 sub-boxes: "Official Documents of Category X" + "Independent Archives of Category Y".
    </output>
  </example>
  <example>
    <input>
Internal debates within a single intellectual current; analysis of a single causal factor; grounded solely in Theory A.
    </input>
    <output>
- CONCEPTUAL: 1 sub-box.
- PROBLEMATIZATION: 1 sub-box.
- CONTEXT: 1 sub-box.
    </output>
  </example>
</examples>

<task>
You are an Academic Epistemological Box Generator. Produce a 5-quadrant hierarchical box structure for a given thesis matrix.
- Analyze the input ThesisMatrix to identify THE CORE EMPIRICAL SUBJECT — the central empirical entity, actor, or phenomenon that constitutes the thesis's primary dependent variable / analytical heart.
- Every semanticQuery in CONTEXT quadrants MUST be synthesized around the identified Core Subject. The query's analytical center of gravity MUST remain locked onto the Core Subject throughout. Macro ruptures must be expressed as DIRECT CONDITIONING, CONSTRAINING, AND STRUCTURAL PRESSURES on the Core Subject — never as standalone world history.
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
- CORE FOCUS: Detect the central empirical subject from the matrix above. CONTEXT queries must remain locked onto this core subject.
- TITLE STANDARD: Titles MUST be concrete and specific (not abstract categories). 5-7 words max. No banned keywords.
- CONCEPTUAL: Pure abstraction. Split distinct theories. No negative exclusion phrases — use positive conceptual purity.
- PROBLEMATIZATION: Empirical actors with universal academic qualifiers. Zero theorist names.
- CONTEXT: Macro ruptures as direct structural pressure on the auto-detected core subject. No generic world history.
- DATA_PROTOCOL: Pure method. No actor or publication names.
- PRIMARY_MATERIAL: semanticQuery MUST be empty string "". Split multiple source categories into distinct sub-boxes.
- OPENALEX: 800-1000 chars per query. Conceptual qualifiers for local names. Max 1000.
- CRITICAL PROSE CONSTRAINT: Every semanticQuery MUST start directly with a high-weight academic noun or concept. FORBIDDEN: 'The research explores', 'This study analyzes', etc.
- NO CONCEPTUAL EMBELLISHMENT: Strictly adhere to the matrix's explicit terminology. FORBIDDEN to inject external ideological descriptors not present in the input.
- Output ONLY valid JSON matching the defined schema.
Think deeply before answering.
</task>`;
}
