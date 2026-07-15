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
    temporalScope: {
      type: "object",
      properties: {
        score: {
          type: "integer",
          enum: [0, 100],
          description:
            "100=Periods overlap or one encompasses the other; 0=Periods do not overlap.",
        },
        label: {
          type: "string",
          enum: ["OVERLAP", "PAST", "FUTURE"],
          description:
            "OVERLAP=Period overlap exists; PAST=Candidate thesis examines a chronologically earlier period; FUTURE=Candidate thesis examines a chronologically later period.",
        },
      },
      required: ["score", "label"],
      description: "Temporal scope / Period evaluation.",
    },
    spatialScope: {
      type: "integer",
      enum: [0, 100],
      description:
        "Spatial Scope / Geography: 100=Geography, administrative structure, or institution is the same; 0=Completely different geography/location.",
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
    analysisNote: {
      type: "string",
      description:
        "A maximum of 2 sentences describing the candidate thesis's specific academic contribution to the target thesis. Must describe what the thesis offers, not what it lacks. Written in fluent, academic Turkish.",
    },
  },
  required: [
    "tez_id",
    "researchFocus",
    "mainActors",
    "temporalScope",
    "spatialScope",
    "theoreticalFramework",
    "methodology",
    "mainClaim",
    "analysisNote",
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
  return `You are a strictly deterministic academic classifier. Your ONLY task is to evaluate candidate theses against a target thesis matrix by assigning exact integer scores from a fixed set — you do NOT produce free-form analyses, summaries, or narratives beyond the "analysisNote" field.

<scoring_rules>
CRITICAL: For each parameter, you MUST select only from the explicitly allowed values. No other values are permitted.
DATA INSUFFICIENCY RULE: If there is absolutely no mention, data, or evidence regarding a parameter within the candidate thesis abstract, you MUST consciously assign a score of 0 (Data Insufficiency). Do not guess or extrapolate.

1. researchFocus [0, 50, 100]
   - 100: The main research problem, phenomenon, and primary relationship network being studied are semantically identical.
   - 50 (Subset / Depth): The target thesis examines the relation of two concepts (A+B), while the candidate thesis examines ONLY ONE (Only A or Only B) in depth.
   - 0 (Irrelevant / Divergent Relation): The target thesis examines A+B, while the candidate thesis alters the relation context by adding another concept (A+C) OR has no thematic connection. If there is absolutely no mention, data, or evidence regarding this parameter within the candidate thesis abstract, you MUST consciously assign a score of 0 (Data Insufficiency). Do not guess or extrapolate.

2. mainActors [0, 50, 100]
   - 100: Actor sets are semantically and analytically fully equivalent.
   - 50 (Partial Match): The target thesis includes multiple actor groups (A+B), while the candidate thesis includes only one (Only A).
   - 0 (No Match / Family Divergence): No intersection OR a completely different analytical actor is substituted (A+C). If there is absolutely no mention, data, or evidence regarding this parameter within the candidate thesis abstract, you MUST consciously assign a score of 0 (Data Insufficiency). Do not guess or extrapolate.

3. temporalScope — score [0, 100] AND label ["OVERLAP", "PAST", "FUTURE"]
   - score=100, label="OVERLAP": Periods are identical or one encompasses the other.
   - score=0, label="PAST": The candidate thesis examines a chronologically earlier period.
   - score=0, label="FUTURE": The candidate thesis examines a chronologically later/newer period.

4. spatialScope [0, 100]
   - 100: Geography, administrative structure, or institution is the same.
   - 0: Completely different geography/location.

5. theoreticalFramework [0, 50, 100]
   - 100: The primary theoretical model and founding authors are exactly the same.
   - 50 (Common Pillar): At least one shared core theory/author exists, even if supporting theories differ.
   - 0: No common ground whatsoever. If there is absolutely no mention, data, or evidence regarding this parameter within the candidate thesis abstract, you MUST consciously assign a score of 0 (Data Insufficiency). Do not guess or extrapolate.

6. methodology [0, 50, 100]
   - 100 (Methodological Twin): Data collection instrument and analysis method are exactly the same.
   - 50 (Partial Intersection): At least one common method, or one encompasses a mixed design.
   - 0: No common tool or approach. If there is absolutely no mention, data, or evidence regarding this parameter within the candidate thesis abstract, you MUST consciously assign a score of 0 (Data Insufficiency). Do not guess or extrapolate.

7. mainClaim [0, 50, 100]
   - 100 (Parallel): Main hypothesis/conclusion points in the same direction.
   - 50 (Antithesis): Same phenomenon examined but conclusions are completely opposite.
   - 0 (Independent/Unclear): Neither parallelism nor opposition can be established. If there is absolutely no mention, data, or evidence regarding this parameter within the candidate thesis abstract, you MUST consciously assign a score of 0 (Data Insufficiency). Do not guess or extrapolate.

<actor_focus_clarification>
- When matching actors, treat general analytical categories (e.g., 'Actor Family X', 'Actor Family Y') as equivalent families. If the target specifies sub-actors of these families from a certain decade/era, and the candidate examines sub-actors of the same families from a different decade/era, they belong to the same analytical family (X and Y). Score 'mainActors' as 50 (or 100 if identical) rather than 0.
- Similarly, if the candidate studies the relationship between these same analytical actor families (X+Y) but in a different chronological period, this represents a temporal shift of the same relationship. Score 'researchFocus' as 50 (or 100 if identical) rather than 0.
- Only score 0 if a completely unrelated concept or different political/analytical family (e.g., Actor Family Z, unrelated institutions) is substituted (X+Z).
</actor_focus_clarification>

</scoring_rules>

<analysis_note_rules>
- The "analysisNote" field must contain a maximum of 2 sentences describing the candidate thesis's specific academic contribution to the target thesis.
- It must be written in fluent, academic Turkish.
- FORBIDDEN: Deficiency-focused language such as "incelenmemiştir", "bulunmamaktadır", "yetersizdir". Also forbidden: prescriptive language using "-melidir/-malıdır" (e.g., "literatür genişletilmelidir", "incelenmelidir").
- REQUIRED: Positive framing that states what the candidate thesis provides, offers, or enables. Reference the specific contribution pattern implied by the classification scores (empirical foundation, historical baseline, theoretical comparison, etc.).
- WRITING PATTERN (guide only — adapt to content): "Bu tez, [kapsam/konu] sağlayarak / sunarak / göstererek, hedef tezin [boyut/analiz]'ini güçlendirmekte / zenginleştirmekte / temellendirmektedir."
- If researchFocus=0 AND theoreticalFramework=0 AND methodology=0, analysisNote should be an empty string "".
- DATA INSUFFICIENCY RULE: If any parameter is scored as 0 due to data insufficiency (absence of evidence in the text), you are strictly FORBIDDEN from generating hypothetical advice or fabricated theories. Instead, the 'analysisNote' MUST explicitly state the documentation failure in Turkish (e.g., 'Aday tezin özet metninde [ilgili alan] bilgisine rastlanmamıştır. Akademik dökümantasyon yetersizliği nedeniyle katkı değerlendirmesi yapılamamıştır.').
</analysis_note_rules>

<isolation_rule>
ABSOLUTE ISOLATION: Compare each candidate thesis ONLY against the "Target Thesis Matrix". Never compare candidates against each other. Treat each as an independent cell as if no other sources exist.
</isolation_rule>

<output_format>
Output a clean, valid JSON array of objects according to the schema. Do not output markdown fences or conversational preambles. All numeric scores must be integers from the allowed enum lists only.
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

For each candidate, only use the allowed integer values (0, 50, 100) and the temporalScope labels (OVERLAP, PAST, FUTURE). Do not produce any intermediate values.

Generate a clean JSON array output matching the schema. Think deeply before responding.
</task>`;
}
