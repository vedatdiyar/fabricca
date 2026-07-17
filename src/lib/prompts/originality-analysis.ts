import type { JsonSchema } from "../services/gemini";

// ============================================================================
// 1. LLM OUTPUT SCHEMA — Strict 0/50/100 Classifier
// ============================================================================

export const tezAnalizSonucuSchema: JsonSchema = {
  type: "object",
  properties: {
    tez_id: {
      type: "string",
      description: "Unique identifier of the evaluated candidate thesis.",
    },
    researchFocus: {
      type: "integer",
      enum: [0, 50, 100],
      description:
        "Research Focus: 100=The main research problem, phenomenon, and primary relationship network are semantically identical; 50=The target thesis examines the relation of two concepts (A+B) while the candidate examines ONLY ONE (Only A or Only B) in depth (Subset / Depth); 0=The target examines A+B while the candidate alters the relation context by adding another concept (A+C) OR has no thematic connection.",
    },
    mainActors: {
      type: "integer",
      enum: [0, 50, 100],
      description:
        "Main Actors: 100=Actor sets are semantically and analytically fully equivalent; 50=The target thesis includes multiple actor groups (A+B) while the candidate includes only one (Only A) (Partial Match); 0=No intersection OR a completely different analytical actor is substituted (A+C) (No Match / Family Divergence).",
    },
    scopeContext: {
      type: "integer",
      enum: [0, 50, 100],
      description:
        "Scope / Context: 100=The historical period, geography, institutional setting, and socio-political background overlap or one encompasses the other; 50=Partial overlap / subset (e.g. target covers the entire historical-societal context, candidate covers only one sub-dimension); 0=Completely different context — different period, geography, or background dynamics.",
    },
    temporalLabel: {
      type: "string",
      enum: ["OVERLAP", "PAST", "FUTURE", "UNKNOWN"],
      description:
        "OVERLAP=Analyzed periods overlap; PAST=Candidate examines a chronologically earlier period; FUTURE=Candidate examines a chronologically later period; UNKNOWN=No temporal data found in the abstract (Data Insufficiency).",
    },
    theoreticalFramework: {
      type: "integer",
      enum: [0, 50, 100],
      description:
        "Theoretical Framework: 100=Primary theoretical model and founding authors are exactly the same; 50=At least one shared core theory/author exists; 0=No common ground whatsoever.",
    },
    methodology: {
      type: "integer",
      enum: [0, 50, 100],
      description:
        "Data Collection & Analysis Method: 100=Data collection instrument and analysis method are exactly the same; 50=At least one method is shared or mixed design; 0=No common tool or approach.",
    },
    mainClaim: {
      type: "integer",
      enum: [0, 50, 100],
      description:
        "Main Claim / Central Argument: 100=Main hypothesis/conclusion points in the same direction (parallel); 50=Same phenomenon examined but conclusions are completely opposite (antithesis); 0=Neither parallelism nor opposition can be established.",
    },
  },
  required: [
    "tez_id",
    "researchFocus",
    "mainActors",
    "scopeContext",
    "temporalLabel",
    "theoreticalFramework",
    "methodology",
    "mainClaim",
  ],
};

export const geminiBatchResponseSchema: JsonSchema = {
  type: "array",
  items: tezAnalizSonucuSchema,
};

// ============================================================================
// 2. SYSTEM INSTRUCTION — Strict Classifier Role
// ============================================================================

export function buildAnalysisSystemInstruction(): string {
  return `You are a strictly deterministic academic classifier. Your ONLY task is to evaluate candidate theses against a target thesis matrix by assigning exact integer scores from a fixed set — you do NOT produce free-form analyses, summaries, or narratives.

<constraints>
CRITICAL: For each parameter, you MUST select only from the explicitly allowed values. No other values are permitted.
DATA INSUFFICIENCY RULE: If there is absolutely no mention, data, or evidence regarding a parameter within the candidate thesis abstract, you MUST consciously assign a score of 0 (Data Insufficiency). Do not guess or extrapolate.
</constraints>

<scoring_rules>

1. researchFocus [0, 50, 100]
   - 100: The main research problem, phenomenon, and primary relationship network being studied are semantically identical.
   - 50 (Subset / Depth): The target examines the relation of two concepts (A+B), while the candidate examines ONLY ONE (Only A or Only B) in depth.
   - 0 (No Match / Divergent Relation): The target examines A+B while the candidate alters the relation by adding a third unrelated concept (A+C). This is strictly treated as Noise/Divergence and must be scored 0. Also score 0 if there is no thematic connection whatsoever.

2. mainActors [0, 50, 100]
   - 100: Actor sets are semantically and analytically fully equivalent.
   - 50 (Partial Match): The target includes multiple actor groups (A+B), while the candidate includes only one (Only A).
   - 0 (No Match / Family Divergence): No intersection OR a completely different analytical actor is substituted (A+C).

3. scopeContext [0, 50, 100]
   CRITICAL: Evaluate whether the broader historical-societal context (period, geography, institutional setting, socio-political background dynamics) overlaps or diverges. This is a unified field — do NOT split temporal and spatial; treat them as one intertwined context.
   - 100: The historical period, geography, institutional setting, and socio-political background are the same or one encompasses the other. There is strong overlap in the overall contextual framework.
   - 50 (Subset): The target covers the full historical-geographical-societal context (Multidimensional A+B), while the candidate covers only ONE dimension or a sub-unit (Only A) — e.g. same period but different geography, or same geography but different period.
   - 0: Completely different context — different period AND different geography, or unrelated background dynamics.

4. temporalLabel ["OVERLAP", "PAST", "FUTURE", "UNKNOWN"]
   CRITICAL: Completely ignore the candidate thesis's publication year from its metadata. Evaluate ONLY based on the historical period discussed / analyzed within the abstract text itself (e.g. century references, date ranges, historical event periods). This field is NOT scored — it is only a directional label.
   - "OVERLAP": The historical periods discussed in the abstracts overlap or one encompasses the other.
   - "PAST": The period discussed in the candidate abstract is chronologically earlier than the period discussed in the target abstract.
   - "FUTURE": The period discussed in the candidate abstract is chronologically later than the period discussed in the target abstract.
   - "UNKNOWN": The candidate abstract contains no temporal data or period indicators whatsoever (Data Insufficiency).

5. theoreticalFramework [0, 50, 100]
   - 100: The primary theoretical model and founding authors are exactly the same.
   - 50 (Common Pillar): At least one shared core theory/author exists, even if supporting theories differ.
   - 0: No common ground whatsoever.

6. methodology [0, 50, 100]
   - 100 (Methodological Twin): Data collection instrument and analysis method are exactly the same.
   - 50 (Partial Intersection): At least one common method, or one encompasses a mixed design.
   - 0: No common tool or approach.

7. mainClaim [0, 50, 100]
   - 100 (Parallel): Main hypothesis/conclusion points in the same direction.
   - 50 (Antithesis): Same phenomenon examined but conclusions are completely opposite.
   - 0 (Independent/Unclear): Neither parallelism nor opposition can be established.

</scoring_rules>

<actor_focus_clarification>
- When matching actors, treat general analytical categories (e.g. 'Actor Family X', 'Actor Family Y') as equivalent families. If the target specifies sub-actors of these families from a certain era, and the candidate examines sub-actors of the same families from a different era, they belong to the same analytical family (X and Y). Score mainActors as 50 (or 100 if identical) rather than 0.
- Similarly, if the candidate studies the relationship between these same analytical actor families (X+Y) but in a different chronological period, this represents a temporal shift of the same relationship. Score researchFocus as 50 (or 100 if identical) rather than 0.
- Only score 0 if a completely unrelated concept or different analytical family (e.g. Actor Family Z, unrelated institutions) is substituted (X+Z).
</actor_focus_clarification>

<isolation_rule>
ABSOLUTE ISOLATION: Compare each candidate thesis ONLY against the Target Thesis Matrix. Never compare candidates against each other. Treat each as an independent cell as if no other sources exist.
</isolation_rule>

<output_format>
Output ONLY a valid JSON array of objects according to the schema. Do not include any markdown fences, conversational preambles, explanations, or any text outside the JSON array. All numeric scores must be integers from the allowed enum lists only.
</output_format>`;
}

// ============================================================================
// 3. PROMPT BUILDER
// ============================================================================

export function buildAnalysisPrompt(
  userThesis: Record<string, string>,
  batchTheses: { id: string; title: string; abstract: string }[],
): string {
  const counterThesesText = batchTheses
    .map(
      (t) =>
        `Candidate Thesis ID: ${t.id}\nTitle: ${t.title}\nAbstract/Text: ${t.abstract}`,
    )
    .join("\n\n");

  return `<context>
<target_thesis_matrix>
${JSON.stringify(userThesis, null, 2)}
</target_thesis_matrix>

<candidate_theses>
${counterThesesText}
</candidate_theses>
</context>

<task>
Compare the <target_thesis_matrix> structure against each candidate in <candidate_theses> as completely independent cells, according to the strict classification rules specified in the System Instructions.

For each candidate, only use the allowed integer values (0, 50, 100) and the temporalLabel values (OVERLAP, PAST, FUTURE, UNKNOWN). Do not produce any intermediate values.

Generate ONLY a clean JSON array output matching the schema with no additional text, markdown fences, or commentary. Think deeply before responding.
</task>`;
}
