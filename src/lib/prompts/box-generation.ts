import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (5-QUADRANT NESTED STRUCTURE)
// ============================================================================

const STANDARD_SUB_BOX = {
  type: "object" as const,
  properties: {
    title: { type: "string" as const },
    description: { type: "string" as const },
    foundationalQueries: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          author: { type: "string" as const },
          title: { type: "string" as const },
          publicationYear: { type: "number" as const },
        },
      },
    },
  },
  required: ["title", "description"],
};

const PRIMARY_SUB_BOX = {
  type: "object" as const,
  properties: {
    title: { type: "string" as const },
    description: { type: "string" as const },
    foundationalQueries: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          author: { type: "string" as const },
          title: { type: "string" as const },
          publicationYear: { type: "number" as const },
        },
      },
    },
  },
  required: ["title", "description"],
};

function buildCategory(
  items: typeof STANDARD_SUB_BOX | typeof PRIMARY_SUB_BOX,
) {
  return {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      concepts: {
        type: "array" as const,
        items: { type: "string" as const },
        maxItems: 5,
      },
      subBoxes: { type: "array", items },
    },
    required: ["title", "description", "concepts", "subBoxes"],
  };
}

/**
 * Gemini'ye gonderilen 5-quadrant nested JSON semasi.
 * PRIMARY_MATERIAL PRIMARY_SUB_BOX kullanir.
 */
export const thesisBoxGenerationSchema: JsonSchema = {
  type: "object",
  properties: {
    conceptual: buildCategory(STANDARD_SUB_BOX),
    problematization: buildCategory(STANDARD_SUB_BOX),
    context: buildCategory(STANDARD_SUB_BOX),
    dataProtocol: buildCategory(STANDARD_SUB_BOX),
    primaryMaterial: buildCategory(PRIMARY_SUB_BOX),
  },
  required: [
    "conceptual",
    "problematization",
    "primaryMaterial",
    "context",
    "dataProtocol",
  ],
};

// ============================================================================
// 2. SISTEM TALIMATI — EVRENSEL TASARRUF + FENOMENOLOJIK BOLME
// ============================================================================

/**
 * OpenAlex vektor uzayi (GTE Large EN) icin optimize edilmis,
 * alan bagimsiz epistemoloji motoru sistem talimati.
 */
export function buildThesisBoxGenerationSystemInstruction(): string {
  return `You are an Architectural Inference Engine that transforms any scientific thesis matrix into a deterministic, hierarchical epistemological data structure.

GENERAL CONTRACT:
1. Language: 'title', 'description' and 'concepts' fields MUST be in academic TURKISH.
2. Scope Safety: Variables explicitly marked "out of scope" or "excluded" in the input matrix must never leak into any field.
3. Foundational Contract: 'foundationalQueries' array MUST be empty ([]) in every sub-box.
4. CONCEPTS CONSTRAINT (ZERO-TOLERANCE HARD LIMIT):
   a. The 'concepts' array is defined EXCLUSIVELY at the category (main box) level. Sub-boxes MUST NOT contain a 'concepts' field under any circumstances.
   b. HARD LIMIT: Each main box MUST contain at most 5 concepts. Generating 6 or more concepts is a DIRECT VIOLATION of the output schema (maxItems: 5). This is NOT a suggestion — it is a structural schema constraint that will cause the output to be rejected.
   c. QUALITY RULE: Select only the most essential keywords or theoretical labels per quadrant. Each concept must be a single, high-density academic term. Prefer 3-5 highly relevant concepts over padding with fringe terms.

QUADRANT-SPECIFIC PRODUCTION PROTOCOLS:

## 1. CONCEPTUAL (Theoretical Pillars)
- Task: Define the independent abstract models, theories, axioms or paradigmatic frameworks upon which the thesis is constructed.
- Dynamic Splitting Principle: If the input matrix contains multiple distinct theoretical backbones or schools, split them into separate sub-boxes.

## 2. PROBLEMATIZATION (Relational Conflict & Structural Tension)
- Task: Extract the core paradoxes, research gaps, systemic bottlenecks or tension lines between variables from the thesis.
- Dynamic Splitting Principle: If the input matrix contains multiple interacting, conflicting, or mutually-distancing empirical foci, subjects or variable clusters, split them into independent sub-boxes. Do not collapse them into a single generic "problem" container.

## 3. CONTEXT (Systemic Background Parameters — PHENOMENOLOGICAL SPLITTING)
- Task: Analyze the systemic, structural, environmental or parametric background conditions surrounding the thesis focus.
- MATRIX-CONDITIONAL CONCEPT GENERATION:
  * Examine the 'researchScope' and 'theoreticalFramework' fields from the input matrix.
  * Identify every independent spatial, temporal, structural, and environmental parameter embedded in these fields (e.g., environmental parameters, system constraints, temporal milestones, structural changes).
  * For EACH identified parameter, create a dedicated CONTEXT sub-box whose title is DERIVED DIRECTLY FROM THAT PARAMETER — not a generic label like "Background" or "General Context".
- Dynamic Splitting Principle: Every independent contextual parameter must become its own sub-box. Do not merge macro parameters with micro parameters.

## 4. DATA_PROTOCOL (Methodological Framework)
- Task: Define the methodological steps, coding schemas, or algorithmic verification processes.
- Dynamic Splitting Principle: Group distinct analytical phases, coding schemas, or test protocols into independent sub-boxes.

## 5. PRIMARY_MATERIAL (Raw Source Layer — No-Scan Layer)
- Task: Group raw data sources, archival documents, corpora or source populations by structural class.`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUSTURUCU
// ============================================================================

/**
 * Tez matrisinden Gemini'ye gonderilecek kullanici promptunu olusturur.
 */
export function buildThesisBoxGenerationPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
}): string {
  const matrixJson = JSON.stringify(params, null, 2);
  return `Analyze the following thesis matrix and produce the 5-quadrant epistemological box structure:
\`\`\`json
${matrixJson}
\`\`\`
CRITICAL OPERATIONAL REMINDERS:
- Apply MATRIX-CONDITIONAL CONCEPT GENERATION: CONTEXT sub-box titles must derive from specific parameters in researchScope/theoreticalFramework.
- Apply DYNAMIC SPLITTING: multiple variables -> multiple sub-boxes.
- CONCEPTS CONSTRAINT (ZERO TOLERANCE): Each main box MUST have at most 5 concepts (maxItems: 5 in schema). Concepts are at the category level ONLY, not sub-box level. Exceeding 5 concepts per main box is a schema violation — the output will be rejected.
- Output ONLY valid JSON matching the defined schema.`;
}
