import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (5-QUADRANT NESTED STRUCTURE)
// ============================================================================
// CİFT ŞEMA: PRIMARY_MATERIAL icin semanticQuery opsiyonel (ZERO PRODUCTION),
// diger kadranlar icin zorunlu (minLength: 1).

const STANDARD_SUB_BOX = {
  type: "object" as const,
  properties: {
    title: { type: "string" as const },
    description: { type: "string" as const },
    concepts: {
      type: "array" as const,
      items: { type: "string" as const },
      minItems: 1,
    },
    semanticQuery: { type: "string" as const, minLength: 1 },
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
  required: ["title", "description", "concepts", "semanticQuery"],
};

const PRIMARY_SUB_BOX = {
  type: "object" as const,
  properties: {
    title: { type: "string" as const },
    description: { type: "string" as const },
    concepts: {
      type: "array" as const,
      items: { type: "string" as const },
      minItems: 1,
    },
    semanticQuery: { type: "string" as const },
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
  required: ["title", "description", "concepts", "semanticQuery"],
};

function buildCategory(
  items: typeof STANDARD_SUB_BOX | typeof PRIMARY_SUB_BOX,
) {
  return {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      subBoxes: { type: "array", items },
    },
    required: ["title", "description", "subBoxes"],
  };
}

/**
 * Gemini'ye gonderilen 5-quadrant nested JSON semasi.
 * PRIMARY_MATERIAL PRIMARY_SUB_BOX kullanir (semanticQuery opsiyonel),
 * diger kadranlar STANDARD_SUB_BOX kullanir (semanticQuery zorunlu).
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
1. Language Division: 'title', 'description' and 'concepts' fields MUST be in academic TURKISH. 'semanticQuery' fields MUST be in ENGLISH as dense academic paragraphs suitable for OpenAlex/GTE-Large EN vector search.
2. Scope Safety: Variables explicitly marked "out of scope" or "excluded" in the input matrix must never leak into any field.
3. Foundational Contract: 'foundationalQueries' array MUST be empty ([]) in every sub-box.
4. UNIVERSAL SAVINGS CONTRACT for semanticQuery (applies to ALL quadrants except PRIMARY_MATERIAL):
   a. MAXIMUM LENGTH: 500 characters. Every character must carry semantic weight.
   b. FORBIDDEN FILLER PATTERNS (ZERO TOLERANCE): Never start with or include phrases like "This study/research/analysis/article/paper examines/explores/investigates/focuses/analyzes." These are prose noise that wastes the character budget.
   c. MANDATORY OPENING: The query MUST start directly with the highest-semantic-weight term — the core subject, theory name, or actor name from the sub-box's title or concepts. The opening 3-5 words must be the most search-relevant terms.
   d. DENSITY RULE: Every word in the query must contribute conceptual or empirical weight. Minimize conjunctions, auxiliary verbs, and prepositional filler. Prioritize noun and proper noun density over verb phrases.

QUADRANT-SPECIFIC PRODUCTION PROTOCOLS:

## 1. CONCEPTUAL (Theoretical Pillars)
- Task: Define the independent abstract models, theories, axioms or paradigmatic frameworks upon which the thesis is constructed.
- Dynamic Splitting Principle: If the input matrix contains multiple distinct theoretical backbones or schools, split them into separate sub-boxes.
- semanticQuery Rule ("Anchored Abstract Mimicry — Positive Filter"):
  * The query MUST be constructed primarily from THIS sub-box's title and concepts array.
   * Opening word: the core theory name (e.g., the specific scientific model or paradigm analyzed — never "This study...").
  * Sentence 1: Core theory + primary mechanism.
  * Sentence 2: Key theorists + conceptual relationship.
  * Sentence 3: Boundary parameters — what the theory explains, stripped of the thesis's own empirical details.
  * General matrix data may be used ONLY as supplementary context, never as the primary content driver.

## 2. PROBLEMATIZATION (Relational Conflict & Structural Tension)
- Task: Extract the core paradoxes, research gaps, systemic bottlenecks or tension lines between variables from the thesis.
- Dynamic Splitting Principle: If the input matrix contains multiple interacting, conflicting, or mutually-distancing empirical foci, subjects or variable clusters, split them into independent sub-boxes. Do not collapse them into a single generic "problem" container.
- semanticQuery Rule ("Positive Filter — Sub-Box Encapsulation"):
  * The query MUST derive its core content primarily from THIS sub-box's own title and concepts.
  * The general matrix data (studyTitle, researchQuestion, mainClaim, etc.) may be used ONLY as supplementary context to fill gaps — never as the primary source of actors, relations or time periods.
   * Opening word: the primary empirical subject or variable conflict from this sub-box (e.g., the specific phenomenon or system component being tested — never "This study...").
  * Sentence 1: Core tension + primary actors directly from this sub-box's title.
  * Sentence 2: Relational mechanism between the actors (adoption, friction, alienation).
  * Sentence 3: Time boundary and context, drawn minimally from the sub-box's concepts.
  * GOAL: Each sub-box produces a DISTINCT search vector. If sub-box A and sub-box B share the same matrix root, their queries MUST NOT be interchangeable.
  * PREVIOUS RULE CANCELLED: Instructions to strip, hide or super-categorize empirical names from semanticQuery are REVOKED. Proper nouns from the matrix MUST be used directly in the English query.

## 3. CONTEXT (Systemic Background Parameters — PHENOMENOLOGICAL SPLITTING)
- Task: Analyze the systemic, structural, environmental or parametric background conditions surrounding the thesis focus.
- MATRIX-CONDITIONAL CONCEPT GENERATION:
  * Examine the 'researchScope' and 'theoreticalFramework' fields from the input matrix.
  * Identify every independent spatial, temporal, structural, and environmental parameter embedded in these fields (e.g., environmental parameters, system constraints, temporal milestones, structural changes).
  * For EACH identified parameter, create a dedicated CONTEXT sub-box whose title is DERIVED DIRECTLY FROM THAT PARAMETER — not a generic label like "Background" or "General Context".
- Dynamic Splitting Principle: Every independent contextual parameter must become its own sub-box. Do not merge macro parameters with micro parameters.
- PHENOMENOLOGICAL SPLITTING — Search Contract:
  * Former restriction on importing variables or state descriptions from the PROBLEMATIZATION quadrant is HEREBY CANCELLED.
  * CONTEXT queries MUST chain the causal/systemic path in a single dense paragraph: System State A -> Environmental/Structural Pressure -> System State B / Target Adaptation.
  * Opening word: the primary background variable or constraint itself directly (e.g., the specific parameter, condition, or structural limit derived from the matrix — never "This study...").
  * Sentence 1: System State A — define the initial condition, baseline parameter, or resting state of the system component under analysis (use proper nouns or technical identifiers from the matrix).
  * Sentence 2: Environmental/Structural Pressure — describe the specific perturbation, constraint, or external force that acts upon System State A, and the causal mechanism through which it propagates.
  * Sentence 3: System State B / Target Adaptation — describe the resulting transformation, phase shift, reorganization, or response of the system component. Name the core variables or sub-components directly.
  * GOAL: Each CONTEXT query must be a self-contained causal/systemic narrative that would enable OpenAlex to retrieve studies about (a) the initial condition, (b) the external pressure, AND (c) the resulting system transformation — simultaneously.

## 4. DATA_PROTOCOL (Methodological Framework)
- Task: Define the methodological steps, coding schemas, or algorithmic verification processes.
- Dynamic Splitting Principle: Group distinct analytical phases, coding schemas, or test protocols into independent sub-boxes.
- semanticQuery Rule: Define only the analytical technique, coding schema, or the mathematical/qualitative mechanics of the method at an abstract level. Never allow empirical bleed-through from other quadrants. Opening word MUST be the method name.

## 5. PRIMARY_MATERIAL (Raw Source Layer — No-Scan Layer)
- Task: Group raw data sources, archival documents, corpora or source populations by structural class.
- semanticQuery Rule ("ZERO PRODUCTION CONTRACT"): ALWAYS return an empty string ("") for the 'semanticQuery' field. This quadrant represents archival/physical data sources that will not be scanned in global academic databases. Do not waste computational tokens.`;
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
- Apply the UNIVERSAL SAVINGS CONTRACT: max 500 chars, no filler openings, start with highest-weight term.
- Apply POSITIVE FILTER: each sub-box query derives core content from its own title+concepts.
- Apply MATRIX-CONDITIONAL CONCEPT GENERATION: CONTEXT sub-box titles must derive from specific parameters in researchScope/theoreticalFramework.
- Apply PHENOMENOLOGICAL SPLITTING: CONTEXT queries chain System State A -> Environmental/Structural Pressure -> System State B / Target Adaptation.
- Apply DYNAMIC SPLITTING: multiple variables -> multiple sub-boxes.
- PRIMARY_MATERIAL: return empty string ("") for semanticQuery.
- Output ONLY valid JSON matching the defined schema.`;
}
