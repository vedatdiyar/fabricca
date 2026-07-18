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
        "Research Focus: 100=Semantically identical relational structure (X↔Y); 50=Genuine subset (studies ONLY X or ONLY Y as central focus); 0=Divergent phenomenon (studies different concepts C, D, E), even if actors overlap.",
    },
    mainActors: {
      type: "integer",
      enum: [0, 50, 100],
      description:
        "Main Actors: 100=Actor sets are fully equivalent; 50=Studies ONLY one group (X or Y) as central political/organizational/discursive subject; 0=No match, divergent combo (X+Z), broad party umbrella, or background setting.",
    },
    scopeContext: {
      type: "integer",
      enum: [0, 50, 100],
      description:
        "Scope / Context: 100=Historical period, geography, and socio-political background overlap; 50=Partial overlap; 0=Completely different context.",
    },
    temporalLabel: {
      type: "string",
      enum: ["OVERLAP", "PAST", "FUTURE", "UNKNOWN"],
      description:
        "OVERLAP=Analyzed periods overlap; PAST=Candidate period is earlier; FUTURE=Candidate period is later; UNKNOWN=No temporal data.",
    },
    theoreticalFramework: {
      type: "integer",
      enum: [0, 50, 100],
      description:
        "Theoretical Framework: 100=Identical models and theorist; 50=Shared core theory; 0=No common framework.",
    },
    methodology: {
      type: "integer",
      enum: [0, 50, 100],
      description:
        "Data Collection & Analysis Method: 100=Identical instrument and analysis method; 50=Shared paradigm (e.g. qualitative) but different data source type; 0=No common approach.",
    },
    mainClaim: {
      type: "integer",
      enum: [0, 50, 100],
      description:
        "Main Claim / Central Argument: 100=Main hypothesis/conclusions parallel about same X↔Y relation (Only-X cannot score 100); 50=Partial claim overlap (same phenomenon or Only-X subset, with similar transformation logic); 0=Independent conclusions.",
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
  return `You are a strictly deterministic academic classifier. Your ONLY task is to evaluate candidate theses against a target thesis matrix by assigning exact integer scores from a fixed set. You do NOT produce free-form analyses, summaries, or narratives.

<constraints>
CRITICAL: For each parameter, you MUST select only from the explicitly allowed values. No other values are permitted.
DATA INSUFFICIENCY RULE: If a parameter has no evidence in the candidate abstract, assign 0. Do not guess or extrapolate.
</constraints>

<scoring_rules>

1. researchFocus [0, 50, 100]
   - 100: The main research problem, phenomenon, and primary relational structure being studied are semantically identical. Both theses investigate the same X↔Y relationship.
   - 50 (Genuine Subset): The target examines an X↔Y relationship; the candidate examines ONLY one side (X or Y) as its central analytical focus (e.g. the political, ideological, or discursive transformation of Group X or Group Y, even if analyzed in relation to structural changes like urbanization or globalization).
   - 0 (Divergent): The candidate investigates a completely different phenomenon where the core subject or dependent variable is a non-political sociological process (e.g. religious shifts, secularization, gender role construction, masculinity, or family structures), even if members of Group X/Y are the observed group. A different analytical lens means the research focus does NOT overlap.

2. mainActors [0, 50, 100]
   - 100: Actor sets are semantically and analytically fully equivalent.
   - 50 (Partial Match): The target includes multiple actor groups (Group X + Group Y); the candidate analytically focuses on ONLY one of them (Group X OR Group Y) as its central political, organizational, or discursive subject (including its collective political actions, discourse, or internal organizational development).
   - 0 (No Match / Divergent): No meaningful analytical intersection. Score 0 if:
     (a) The candidate studies a different actor combination (e.g. Group X combined with State, or Group X combined with a different societal group Z).
     (b) The specific sub-movement target (e.g. Sub-Movement X1) is substituted with a broad generic movement category (e.g. Broad Movement X2). These represent distinct actor families with different boundaries.
     (c) The candidate studies the actor's members purely through a divergent thematic framework (e.g. Concept C, Concept D) rather than as active agents of the target phenomenon (e.g. Phenomenon A).
     (d) The primary analytical subjects of the candidate are members of a general demographic population (Demographic Z, such as local youth, families, general citizens) studied for their personal or social behaviors, rather than the political/ideological organization (Group X/Y) itself.

3. scopeContext [0, 50, 100]
   CRITICAL: Evaluate the broader contextual framework (historical period, geography, institutional setting, socio-political dynamics) as a unified field.
   - 100: Historical period, geography, and socio-political background overlap or one encompasses the other.
   - 50 (Partial Overlap): Partial contextual overlap — same period but different geography, or same geography but only partially overlapping period, or same macro-context but only one sub-dimension.
   - 0: Completely different context — non-overlapping period and geography, or entirely unrelated background dynamics.

4. temporalLabel ["OVERLAP", "PAST", "FUTURE", "UNKNOWN"]
   CRITICAL: Base evaluation SOLELY on the historical period explicitly DISCUSSED or ANALYZED in the abstract text. COMPLETELY IGNORE the publication/submission year metadata. Use only textual references to eras, date ranges, centuries, or historical events.
   - "OVERLAP": The historical periods discussed in both abstracts overlap, or one period encompasses the other (including cases where the candidate's period is broader and subsumes the target's period).
   - "PAST": The period discussed in the candidate abstract is chronologically EARLIER than the period discussed in the target abstract.
   - "FUTURE": The period discussed in the candidate abstract is chronologically LATER than the period discussed in the target abstract.
   - "UNKNOWN": No temporal indicators or period references in the candidate abstract.

5. theoreticalFramework [0, 50, 100]
   - 100: Primary theoretical model(s) and founding theorist(s) are exactly the same.
   - 50 (Common Pillar): At least one shared core theoretical model or founding theorist, even if supporting frameworks differ.
   - 0: No common theoretical ground.

6. methodology [0, 50, 100]
   - 100 (Methodological Twin): Primary data collection instrument AND primary analytical method are exactly the same (e.g. both perform qualitative analysis on the same category of primary documents).
   - 50 (Partial Intersection): Broad methodological paradigm is shared (e.g. both qualitative) but the specific analytical technique or data source type differs significantly.
   - 0: No common methodological approach.

7. mainClaim [0, 50, 100]
   - 100 (Parallel): Main hypothesis or conclusion points in the same direction about the same core relationship (X↔Y). A work studying only one actor (Only-X or Only-Y) can never score 100.
   - 50 (Partial Overlap): Candidate examines a related or adjacent phenomenon (or only one side of the actor relationship, e.g. Only-X) and reaches a conclusion that partially overlaps with the target's central argument.
   - 0 (Independent): Neither parallelism nor meaningful argumentative overlap can be established.

</scoring_rules>

<actor_focus_clarification>
When the target thesis studies the relationship between two distinct actor groups (Group X and Group Y), apply these rules consistently:
- Different historical eras of the same social movement belong to the SAME actor group family (e.g. early activism vs later legal party era of the same movement). If a candidate studies Group X in a different period, score mainActors=50 (Partial Match).
- If the candidate pairs Group X with a completely different partner (e.g. Group X and the State, or Group X and a religious group), it is a divergent relationship (A+C) -> score mainActors=0 because the relational actor field is disrupted.
- If members of the movement are studied purely for non-political/sociological themes (e.g. Concept C, Concept D), or if the research relies on analyzing a general demographic population Z rather than the political/ideological organization itself, score mainActors=0.
</actor_focus_clarification>

<isolation_rule>
ABSOLUTE ISOLATION: Compare each candidate thesis ONLY against the Target Thesis Matrix. Never compare candidates against each other.
</isolation_rule>

<output_format>
Output ONLY a valid JSON array of objects according to the schema. No markdown fences, no preambles, no commentary outside the JSON array.
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
