import type { JsonSchema } from "../services/gemini";

// ============================================================================
// 1. PARAMETER DEFINITIONS
// ============================================================================

export interface ParamDefinition {
  key: string;
  label: string;
  description: string;
  isStringEnum: boolean;
  jsonSchema: JsonSchema;
}

export const PARAM_DEFINITIONS: ParamDefinition[] = [
  {
    key: "RC",
    label: "Araştırma Odağı",
    description:
      "The degree to which the candidate thesis's primary research focus — including both the core intellectual problem AND the main actors, subjects, or analytical objects — matches the target's research core. Evaluate the COMBINED research problem and its subjects: what specific phenomenon, relationship, process, or knowledge gap is investigated, AND which actors/groups/organizations are the primary subjects of analysis. Score 100 if the candidate investigates the same or nearly identical problem-actor constellation. Score 50 if the candidate investigates a related but distinct sub-problem within the same domain (e.g., Discipline A), OR if the same problem is studied through different but adjacent actors/subjects. Score 0 if the candidate's primary inquiry falls into a fundamentally different academic discipline, field of study, or theoretical domain (e.g., Discipline B) — even if the subjects, actors, or geographic settings (e.g., Actor X, Region Y) appear identical. A shared actor or geographic setting alone does not justify a score of 50 if the core inquiry belongs to a completely different field or domain.",
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
    label: "Mekânsal Bağlam",
    description:
      "The degree to which the geographic setting and spatial context of the candidate thesis match those of the target. Evaluate ONLY the geographic, spatial, or institutional setting — not the historical period (which is evaluated separately). Score 100 if the candidate studies the same or overlapping geographic region, country, or institutional space. Score 50 if the candidate studies an adjacent, comparable, or broadly similar geographic context. Score 0 if the candidate is situated in a fundamentally different geographic or institutional setting.",
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
    description:
      "The degree to which the specific theoretical traditions, conceptual frameworks, or theorists employed as the primary analytical lens in the candidate thesis match those of the target. Score 100 if the candidate uses the same specific theory or theorist. Score 50 if the candidate draws from the same broad theoretical paradigm or tradition (e.g., both within critical theory, both within discourse analysis traditions, both within a shared sociological paradigm family). Score 0 if the candidate employs a completely different theoretical tradition.",
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
    label: "Yöntem",
    description:
      "The degree to which the candidate thesis's primary analytical technique and data category type match those of the target. Evaluate the METHOD TYPE (e.g., qualitative discourse analysis, ethnographic fieldwork, quantitative survey, archival research, content analysis), NOT the specific data sources. Score 100 if the candidate uses the same primary analytical technique AND the same data category type. Score 50 if both share the same methodological paradigm (qualitative or quantitative) but differ in technique or data category. Score 0 if the candidate uses a fundamentally different methodology. Do NOT score based on shared specific sources; the mere fact that two theses use the same publication or archive as a data source does not alone qualify for a high score.",
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
    description:
      "The degree to which the candidate thesis's central argument, conclusion, or contribution claim overlaps with the target's main claim. Score 100 if the candidate makes a parallel or nearly identical central argument, or arrives at a substantially similar conclusion. Score 50 if the candidate makes a partially overlapping argument or a claim pointing in the same direction. Score 0 if the candidate's central claim is completely different or unrelated to the target's.",
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
    description:
      "Does the candidate thesis's analyzed historical period overlap with the target's period? If the abstract does not explicitly state a date range, infer the period from historical events, political formations, or named figures mentioned in the title or abstract. If inference is impossible after consulting both title and abstract, use UNKNOWN. OVERLAP=The candidate's period overlaps with or contains the target's period; PAST=The candidate's period is entirely earlier than the target's; FUTURE=The candidate's period is entirely later than the target's; UNKNOWN=No temporal data can be determined from title or abstract.",
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

export function buildIsolatedPrompt(
  targetMatrix: Record<string, string>,
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
<target_thesis_matrix>
${JSON.stringify(targetMatrix, null, 2)}
</target_thesis_matrix>

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
