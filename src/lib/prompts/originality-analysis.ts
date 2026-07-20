import type { JsonSchema } from "../services/gemini";

// ============================================================================
// 1. PARAMETER DEFINITIONS
// ============================================================================

/** Keys of the target thesis matrix that map to each scoring parameter. */
export type MatrixField =
  | "researchCore"
  | "spatialContext"
  | "temporalContext"
  | "theoreticalFramework"
  | "methodology"
  | "mainClaim";

export interface ParamDefinition {
  key: string;
  label: string;
  description: string;
  /** The single target matrix field this parameter evaluates against. */
  matrixField: MatrixField;
  isStringEnum: boolean;
  jsonSchema: JsonSchema;
}

export const PARAM_DEFINITIONS: ParamDefinition[] = [
  {
    key: "RC",
    label: "Araştırma Konusu / Olgu",
    matrixField: "researchCore",
    description:
      "The degree to which the candidate thesis's research topic or phenomenon under investigation matches the target's research core.\n\nCRITICAL - Focus ONLY on the core conceptual/theoretical phenomenon or social problem being studied (e.g., gentrification, pop music representation, clientelism, structural reform). Ignore the specific actors/groups (evaluated in Actor) and ignore the geographical scope (evaluated in SC).\n\nScore 100 if the candidate investigates the exact same research topic or phenomenon in the same analytical dimension.\nScore 50 if the candidate addresses a closely related or overlapping phenomenon within the same conceptual family (e.g., studying political party communication when the target is party ideology; or housing policy when the target is gentrification).\nScore 0 if the candidate's research topic/phenomenon has no meaningful relation to the target's.",
    isStringEnum: false,
    jsonSchema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tez_id: { type: "integer" },
          score: { type: "integer", enum: [0, 50, 100] },
        },
        required: ["tez_id", "score"],
        additionalProperties: false,
      },
    },
  },
  {
    key: "Actor",
    label: "Aktör / Odak Grup",
    matrixField: "researchCore",
    description:
      "The degree to which the target actors, organizations, population groups, or subjects analyzed in the candidate thesis match those of the target's research core.\n\nCRITICAL - Focus ONLY on who or what is being analyzed (e.g., political parties, Syrian refugees, local municipalities, a specific author's texts). Ignore the phenomenon/topic (evaluated in RC) and ignore the physical geography (evaluated in SC).\n\nScore 100 if the candidate studies the exact same actor groups or institutional actors.\nScore 50 if the candidate studies a partially overlapping or closely related actor group (e.g., local councils when the target is municipalities; or a different political party in the same country; or refugees in general when the target is Syrian refugees).\nScore 0 if the candidate studies a fundamentally different actor group with no logical overlap.",
    isStringEnum: false,
    jsonSchema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tez_id: { type: "integer" },
          score: { type: "integer", enum: [0, 50, 100] },
        },
        required: ["tez_id", "score"],
        additionalProperties: false,
      },
    },
  },
  {
    key: "SC",
    label: "Coğrafi Bağlam",
    matrixField: "spatialContext",
    description:
      "The degree to which the physical geographic setting (country, city, region) of the candidate thesis matches that of the target.\n\nCRITICAL - Evaluate ONLY the geographic limits. Do NOT let the historical period (evaluated in Temporal), the actors (evaluated in Actor), or the institutional/organizational setting (evaluated in Actor) influence this score.\n\nScore 100 if the candidate studies the exact same country, city, or geographical region as the target.\nScore 50 if: (a) the candidate studies a neighboring country or a region within the same broader geopolitical zone as the target (e.g., both in the Middle East, both in the Balkans, both in post-Soviet space); OR (b) the candidate is a multi-context comparative study that includes the target's geography as one case among several others.\nScore 0 if the candidate is situated in a fundamentally different geographic region with no meaningful spatial overlap with the target.",
    isStringEnum: false,
    jsonSchema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tez_id: { type: "integer" },
          score: { type: "integer", enum: [0, 50, 100] },
        },
        required: ["tez_id", "score"],
        additionalProperties: false,
      },
    },
  },
  {
    key: "TF",
    label: "Kuramsal Çerçeve",
    matrixField: "theoreticalFramework",
    description:
      "The degree to which the specific theoretical traditions, conceptual frameworks, or theorists employed as the primary analytical lens in the candidate thesis match those of the target.\n\nCRITICAL - Do NOT infer or assume a theoretical framework from the research topic, subject matter, or actors alone. Base your score ONLY on explicit evidence found in the candidate's title or abstract. Do NOT confuse research methodology (e.g., qualitative interviews) with theoretical lens. If no theoretical framework or theorist is explicitly named or clearly described, assign 0.\n\nScore 100 if the abstract or title explicitly names and employs the same specific theory, model, or theorist as the target (e.g., both explicitly use Snow & Benford's Framing Theory; both explicitly apply Gramscian hegemony).\nScore 50 if the abstract or title explicitly references the same named theoretical school, tradition, or paradigm family as the target, but uses a different specific variant, theorist, or model within that family (e.g., target uses Gramscian hegemony, candidate uses neo-Marxist state theory; both are within the Marxist critical tradition).\nScore 0 if the candidate employs a completely different theoretical tradition, OR if no theoretical framework is mentioned or clearly inferable from the abstract or title.",
    isStringEnum: false,
    jsonSchema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tez_id: { type: "integer" },
          score: { type: "integer", enum: [0, 50, 100] },
        },
        required: ["tez_id", "score"],
        additionalProperties: false,
      },
    },
  },
  {
    key: "ME",
    label: "Araştırma Yöntemi",
    matrixField: "methodology",
    description:
      "The degree to which the candidate thesis's primary analytical technique matches that of the target.\n\nCRITICAL - Focus strictly on the research method type and design (e.g., quantitative regression, qualitative discourse analysis, ethnography, content analysis, historical comparative analysis). Do NOT let the data source (e.g., newspapers, archives, manifestos) or data collection subjects (evaluated in Actor) influence this score.\n\nScore 100 if the candidate uses the same primary analytical technique (e.g., both use critical discourse analysis; both use semi-structured interviews and thematic analysis).\nScore 50 if both theses share the same broad methodological paradigm (both qualitative OR both quantitative) but differ in their primary analytical technique.\nScore 0 if the candidate uses a fundamentally different methodological paradigm from the target (e.g., target is qualitative discourse analysis, candidate is quantitative regression).",
    isStringEnum: false,
    jsonSchema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tez_id: { type: "integer" },
          score: { type: "integer", enum: [0, 50, 100] },
        },
        required: ["tez_id", "score"],
        additionalProperties: false,
      },
    },
  },
  {
    key: "MC",
    label: "Merkez Sav",
    matrixField: "mainClaim",
    description:
      "The degree to which the logical structure and direction of the candidate thesis's central argument matches the target's main claim.\n\nCRITICAL - Focus strictly on the argumentative direction and relationships (e.g., causal link, critique of power, discursive shift, positive correlation) rather than repeating the specific nouns/actors. If the target's main claim contains multiple distinct sub-arguments or contributions, and the candidate's central argument overlaps with only some, score 50 - NOT 100.\n\nScore 100 if the candidate's argument matches both the primary direction of the claim and its key sub-arguments or conclusions in their entirety.\nScore 50 if: (a) the candidate's argument overlaps with only some of the target's sub-claims; OR (b) the candidate reaches a similar general conclusion through a substantially different argumentative path; OR (c) the candidate's claim points in the same general direction as the target's but is narrower or broader in scope.\nScore 0 if the candidate's central claim is completely unrelated to the target's, or argues for the opposite position.",
    isStringEnum: false,
    jsonSchema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tez_id: { type: "integer" },
          score: { type: "integer", enum: [0, 50, 100] },
        },
        required: ["tez_id", "score"],
        additionalProperties: false,
      },
    },
  },
  {
    key: "Temporal",
    label: "Tarihsel Dönem",
    matrixField: "temporalContext",
    description:
      "Does the candidate thesis's analyzed historical period overlap with the target's period? Use the following priority order: (1) Explicit date ranges stated in the abstract or title; (2) Named historical events, political formations, or eras whose dates are well-established (e.g., 'Cold War', 'Ottoman period', '1980 coup'); (3) Named political parties, leaders, or regimes with known active periods. If inference is impossible after consulting both title and abstract, use UNKNOWN.\n\nOVERLAP = The candidate's analyzed period shares at least one year with the target's period — including cases where the candidate's period partially overlaps, fully contains, or is fully contained within the target's period.\nPAST = The candidate's period ends entirely before the target's period begins — with no year in common.\nFUTURE = The candidate's period begins entirely after the target's period ends — with no year in common.\nUNKNOWN = No temporal information can be determined or inferred from the title or abstract, even after applying the inference rules above.\n\nCRITICAL: Do NOT use UNKNOWN if a reasonable inference is possible from named events, eras, or formations. UNKNOWN is reserved strictly for cases where no temporal anchor exists at all.",
    isStringEnum: true,
    jsonSchema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tez_id: { type: "integer" },
          score: {
            type: "string",
            enum: ["OVERLAP", "PAST", "FUTURE", "UNKNOWN"],
          },
        },
        required: ["tez_id", "score"],
        additionalProperties: false,
      },
    },
  },
];

// ============================================================================
// 2. SYSTEM INSTRUCTION
// ============================================================================

export function buildIsolatedSystemInstruction(): string {
  return `You are an impartial academic classifier. Your ONLY task is to evaluate candidate theses against a target thesis matrix by scoring them on a single specified dimension.

<constraints>
CRITICAL: Use ONLY the allowed score values specified in the task. No other values are permitted.
DIMENSION ISOLATION: Score ONLY the dimension stated in the task. Each dimension has a precise scope defined below. Do not let evidence relevant to one dimension influence your score on another.
DATA INSUFFICIENCY RULE: If the dimension has no evidence in the candidate abstract or title, assign the lowest value (0 for numeric dimensions, UNKNOWN for temporal).
ABSOLUTE ISOLATION: Compare each candidate thesis ONLY against the target thesis matrix. Never compare candidates against each other.
GENERALITY RULE: Apply each dimension's definition in a domain-agnostic way. The definitions are designed to work across any academic field, discipline, or geographic context.
</constraints>

<output_format>
Output ONLY a valid JSON array of objects according to the schema. No markdown fences, no preambles, no commentary outside the JSON array.
</output_format>`;
}

// ============================================================================
// 3. ISOLATED PROMPT BUILDER
// ============================================================================

/**
 * Builds the isolated scoring prompt for a single parameter.
 * Only the target matrix field relevant to this parameter is exposed to the
 * model — all other matrix fields are intentionally withheld to prevent
 * cross-dimensional contamination.
 *
 * @param targetFieldValue - The single target matrix field value for this parameter
 * @param theses - Candidate theses (id, title, abstract)
 * @param param - The parameter definition being scored
 * @returns The full prompt string for this isolated scoring call
 */
export function buildIsolatedPrompt(
  targetFieldValue: string,
  theses: { id: number; title: string; abstract: string }[],
  param: ParamDefinition,
): string {
  const thesesXml = theses
    .map(
      (t) =>
        `<thesis>\n<id>${t.id}</id>\n<title>${t.title}</title>\n<abstract>${t.abstract}</abstract>\n</thesis>`,
    )
    .join("\n");

  const scoreValues = param.isStringEnum
    ? '"OVERLAP", "PAST", "FUTURE", "UNKNOWN" (string)'
    : "0, 50, or 100 (integer)";

  return `<context>
<target_field label="${param.label}">
${targetFieldValue}
</target_field>

<candidate_theses>
${thesesXml}
</candidate_theses>
</context>

<task>
Score each candidate thesis ONLY on the "${param.label}" dimension.

Definition of "${param.label}": ${param.description}

Scoring:
- 100 = Fully relevant / high similarity on this dimension
- 50 = Partially relevant / partial similarity on this dimension
- 0 = Not relevant / unrelated on this dimension
${param.isStringEnum ? "- For this dimension, use string values instead: OVERLAP, PAST, FUTURE, UNKNOWN" : ""}

Output a JSON array of objects. Each object must have:
- "tez_id": the numeric thesis ID (integer)
- "score": ${scoreValues}

Return exactly ${theses.length} objects, one per thesis, in the same order as the candidate_theses list above.
</task>`;
}
