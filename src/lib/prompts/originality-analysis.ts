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
        "Research Focus: Does the candidate ask the SAME RESEARCH QUESTION as the target? The research question includes the actor(s) — they are not evaluated independently. 100=Same research question about both target actors and their relationship (as defined in the matrix); 50=Target asks about the relationship between both target actors, candidate asks the same directional question about only the first or only the second target actor; 0=Different research question (different actor pairing — first target actor with a different second actor, or a genuinely different phenomenon even with overlapping actors).",
    },
    mainActors: {
      type: "integer",
      enum: [0, 50, 100],
      description:
         "Main Actors: Who/what are the actor(s) studied in the candidate? Actors can be generalized into broader families. 100=Both target actors (the first AND the second actor from the matrix); 50=Only one of the target's actors (only the first or only the second target actor); 0=Different actor combination (first target actor with a different second actor, neither target actor, or completely unrelated actors). NOTE: Unlike ResearchFocus, MainActors evaluates ONLY the actor set — independent of the research question.",
    },
    scopeContext: {
      type: "integer",
      enum: [0, 50, 100],
      description:
        "Scope / Context: Geography, institutional setting, and socio-political dynamics ONLY — does NOT include historical period (see temporalLabel). 100=Same geography, same socio-political background; 50=Partial overlap (same country, different region; or same macro dynamics, different sub-dimension); 0=Completely different geography or socio-political environment.",
    },
    temporalLabel: {
      type: "string",
      enum: ["OVERLAP", "PAST", "FUTURE", "UNKNOWN"],
      description:
        "OVERLAP=The candidate's analyzed historical period overlaps with the target's (including when the candidate's period is broader and fully contains the target's); PAST=Candidate's period is entirely earlier; FUTURE=Candidate's period is entirely later; UNKNOWN=No temporal data in abstract.",
    },
    theoreticalFramework: {
      type: "integer",
      enum: [0, 50, 100],
      description:
        "Theoretical Framework: Does the candidate use the SAME THEORIST(S) and SAME CONCEPT(S) as the target? 100=Identical theorists and identical concepts; 50=Same theorist(s) but different concepts/focus within their framework; 0=Different theorist(s) or different conceptual framework — even if from the same broad tradition (e.g. Gramsci vs Laclau&Mouffe; Snow&Benford vs Goffman).",
    },
    methodology: {
      type: "integer",
      enum: [0, 100],
      description:
        "Methodology: 100=Same analysis technique AND same data source category (e.g. discourse analysis on written/printed documents); 0=Different analysis technique OR different data source category (e.g. discourse analysis conducted through interviews; quantitative analysis; content analysis; ethnography).",
    },
    mainClaim: {
      type: "integer",
      enum: [0, 50, 100],
      description:
        "Main Claim / Central Argument: Does the candidate reach the SAME CONCLUSION as the target? 100=Parallel conclusion about the same actor pair relationship (both target actors from the matrix); 50=Candidate studies only the first or only the second target actor and reaches a conclusion in the same direction/logic as the target's argument; 0=Independent or different conclusion, or no clear conclusion stated in the abstract.",
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
   IMPORTANT: ResearchFocus asks about the RESEARCH QUESTION. The actor(s) are PART of the research question — do not evaluate them independently here.
    - 100: The candidate asks the exact same research question as the target — the same phenomenon about the relationship between both target actors.
    - 50 (Genuine Subset): The target asks about the relationship between two target actors; the candidate asks the same directional question but about ONLY one side — only the first or only the second target actor as its central analytical focus. The question is a subset of the target's, not a different one.
    - 0 (Divergent): The candidate asks a different research question. This includes: (a) studying the first target actor paired with a different second actor, because the actor set defines the research question itself; (b) studying a genuinely different phenomenon or analytical lens (e.g. religious shifts, secularization, gender, urbanization, economic structure) even if the first target actor appears as the study population.

 2. mainActors [0, 50, 100]
    IMPORTANT: MainActors asks ONLY about the actor set — who/what is being studied. Independent of the research question. Actors can be generalized into broader families (e.g. narrower sub-movements or organizations all belong to the same target actor family).
     - 100: The candidate studies both target actors (the first AND the second actor from the matrix).
     - 50 (Single Actor): The candidate studies only ONE of the target's actors (only the first or only the second target actor), with no second target actor present.
     - 0 (Divergent Pairing): The candidate studies a different actor combination. Score 0 if:
       (a) One target actor is present but paired with a DIFFERENT second actor outside the target pair.
       (b) A generic movement category that does NOT belong to the same actor family as any target actor — e.g. if the target's first actor is a specific organization and the candidate studies a different organization or a broad generic category outside that same family, score 0.
      (c) The analytical subjects are a general demographic population rather than the political/ideological organization itself. This applies ONLY when the primary subjects are ordinary individuals (citizens, youth, students, women, families, etc.) studied for their personal/social characteristics or behaviors in a political context. If the primary analytical subjects are political actors (party members, cadres, politicians, movement intellectuals, members, sympathizers, voters) studied in their capacity as movement actors, then MA is evaluated based on the political movement — do NOT downgrade to 0.

3. scopeContext [0, 50, 100]
   CRITICAL: ScopeContext evaluates geography, institutional setting, and socio-political dynamics ONLY. Historical period is evaluated SEPARATELY under temporalLabel — do NOT use it here.
   - 100: Same geography (country/region) and same socio-political background (e.g. both study Turkey in the 90s conflict/neoliberal context).
   - 50 (Partial Overlap): Same country but different region, or same macro dynamics but different institutional sub-dimension.
   - 0: Completely different geography or socio-political environment (e.g. different country, different political system context).

4. temporalLabel ["OVERLAP", "PAST", "FUTURE", "UNKNOWN"]
   CRITICAL: temporalLabel evaluates the HISTORICAL PERIOD ONLY. Geography and socio-political context are evaluated SEPARATELY under scopeContext. Base evaluation SOLELY on the candidate's PRIMARY analytical timeframe — the period within which its core research question and data collection are situated. Background historical overviews, long-term trends, and contextual framing periods for the general history of a topic do NOT count toward the period. COMPLETELY IGNORE the publication/submission year metadata.
   - "OVERLAP": The periods discussed overlap in any way, INCLUDING when the candidate's period is broader and fully contains the target's period.
   - "PAST": The candidate's period is entirely earlier than the target's period, with no containment or overlap.
   - "FUTURE": The candidate's period begins at or after the target's period ends, and does not encompass the target's period.
   - "UNKNOWN": No period is stated or clearly implied by the abstract text itself. Do not infer from metadata.

5. theoreticalFramework [0, 50, 100]
   IMPORTANT: Evaluate whether the candidate uses the SAME theorist(s) AND the SAME concept(s) as the target. A shared broad tradition is NOT enough.
   - 100: Same theorist(s) AND same specific concept(s) — e.g. both use Gramsci's hegemony concept in the same way.
   - 50 (Same Theorist, Different Concept): Same theorist(s) but different concepts within their framework — e.g. both use Gramsci but one focuses on hegemony, the other on passive revolution.
   - 0 (Different Framework): Different theorist(s), or conceptually distinct frameworks even if from a similar tradition — e.g. Gramsci vs Laclau&Mouffe; Snow&Benford vs Goffman; Bourdieu vs Gramsci.

6. methodology [0, 100]
   IMPORTANT: This is a BINARY parameter — score ONLY 0 or 100. No intermediate values.
    - 100 (Methodological Twin): Same analysis technique AND same data source category. Variants or subtypes of the same analysis technique (e.g. critical discourse analysis, qualitative discourse analysis, discourse-historical analysis) count as the same technique. Example: both use discourse analysis on written/printed documents (party programmes, journals, newspapers).
   - 0: Different analysis technique OR different data source category. Examples: discourse analysis conducted through interviews (different source category); content analysis; quantitative/statistical methods; ethnography. Also 0 if the abstract does not clearly state a method.

7. mainClaim [0, 50, 100]
   IMPORTANT: MainClaim asks whether the candidate's CONCLUSION matches the target's central argument. Not about the question asked — about the answer reached.
    - 100 (Parallel): The candidate reaches the same conclusion about both target actors and their relationship. Single-actor works can NEVER score 100, no exceptions.
    - 50 (Partial Overlap): The candidate studies only the first or only the second target actor and reaches a conclusion in the same direction/logic as the target's central argument (e.g. "the first actor's transformation was an adaptation, not a rupture").
   - 0 (Independent): The candidate's conclusion does not overlap with the target's argument, OR the abstract does not clearly state a conclusion — treat missing information the same as a genuine mismatch.

</scoring_rules>

<actor_focus_alignment>
ResearchFocus and MainActors ask different questions and can diverge:

- RF = same RESEARCH QUESTION (includes actors as part of the question)
- MA = same ACTOR SET (who is studied, independent of what is asked)

Possible combinations:
- Both target actors + research question about their relationship → RF=100, MA=100
- Only first target actor + question about that actor alone → RF=50, MA=50
- Both target actors present + different question about them → RF=0, MA=100
- First target actor paired with a different second actor → RF=0 (different question, different actors), MA=0 (wrong pairing)

Actor family rule:
- Different historical eras, ancestral organizations, or predecessor movements belonging to the same broader social movement family count as the SAME target actor. Score MA=50 for same family/different era.
- A general demographic population (local youth, families, citizens) studied for personal/social behaviors is NOT the same actor as a political/ideological organization. Score MA=0.
</actor_focus_alignment>

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

Think deeply before responding.
</task>`;
}
