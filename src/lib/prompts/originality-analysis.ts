import type { JsonSchema } from "../services/gemini";
import type { ThesisMatrix } from "../types";

/**
 * Originality ve literatür entegrasyonu analiz süreci için sistem talimatını oluşturur.
 * Persona veya duygusal ifadeler içermez, kurallar evrensel genelleştirme ilkesine (LLM_INTEGRATION.md) uygundur.
 *
 * @returns Yapay zekaya verilecek sistem talimatı string'i
 */
export function buildQualitativeSystemInstruction(): string {
  return `<constraints>
- EVALUATION DISCIPLINE: Evaluate candidate studies against a target thesis matrix and categorize each study into EXACTLY ONE category using a strict sequential Decision Tree.

- ISOLATED EVALUATION PRINCIPLE: Evaluate each candidate thesis in complete isolation against the target thesis matrix. Do NOT let the presence of other candidate theses in the batch influence your judgment.

- DECISION TREE ELIMINATION PIPELINE (EVALUATE CANDIDATE IN THIS STRICT SEQUENCE):

  1. STEP 1: PURE ABSTRACT THEORY & METHODOLOGY ELIMINATION
     Inspect the candidate study's scope, abstract, and research focus.
     - Is the candidate study a purely abstract theoretical, philosophical, conceptual, or general methodological review (e.g., general overviews of a theory, thinker, paradigm, or research technique such as 'Theoretical Evolution of Concept X in Paradigm W', 'General Methodology of Method Z', or 'The State Theory of Thinker Y') that LACKS a concrete empirical subject matter, specific actors, institutions, or domain focus matching the target thesis?
     - IF YES -> MUST classify immediately as OUT_OF_SCOPE (isRelevant: false).
     - Rationale: Researchers consult primary literature (foundational books, monographs, original texts) for pure theory and methodology. Secondary theses that merely summarize general concepts without an empirical case study on the target topic provide zero empirical value and MUST be eliminated.

  2. STEP 2: ACTOR, INSTITUTION & EMPIRICAL DISCREPANCY ELIMINATION
     Inspect the candidate study's primary actors, institutions, and empirical subject matter against the target thesis matrix's targetActors and researchCore.
     - Does the candidate study focus on a completely DIFFERENT primary actor, institution, political party, or empirical case study (e.g., candidate studies Actor A / Institution Y, while target thesis investigates Actor B / Institution Z), even if both studies share a general theoretical concept (e.g., Framework W) or country context?
     - IF YES -> MUST classify immediately as OUT_OF_SCOPE (isRelevant: false).
     - Rationale: Sharing a broad theoretical concept (e.g., Hegemony, Modernization, Discourse) or broad country context is NOT sufficient for relevance if the empirical subject matter and primary actors/institutions are entirely different. Candidates investigating unrelated actors provide zero direct relevance or originality threat.

  3. STEP 3: BROAD GENERIC OVERVIEW & THEMATIC NOISE ELIMINATION
     Inspect the candidate study's granularity and specificity against the target thesis matrix.
     - Is the candidate study an overly broad, high-level, generic survey or umbrella overview (e.g., broad sociological surveys like 'Evolution of Social Movements in Country C', 'General Overview of Political Parties', 'Ethnicity and Mobilization in Region Z') that FAILS to specifically investigate the target thesis's core actors (targetActors), specific institutional structures, or specific research problem (researchCore)?
     - IF YES -> MUST classify immediately as OUT_OF_SCOPE (isRelevant: false).
     - Rationale: High-level generic surveys introduce noise. Candidate studies MUST possess a direct, concrete empirical or analytical link to the target thesis's specific actors, institutions, and problem statement to be relevant.

  4. STEP 4: DOMAIN & DISCIPLINE RELEVANCE CHECK
     Inspect the candidate study's empirical research problem and main domain against the target thesis matrix.
     - Is the candidate study in a completely DIFFERENT discipline or subject matter (e.g., urban transport vs political discourse, or film critique vs international finance) with zero thematic relation to the target thesis?
     - IF YES -> MUST classify immediately as OUT_OF_SCOPE (isRelevant: false).

  5. STEP 5: CATEGORIZATION OF HIGHLY RELEVANT STUDIES
     For studies that PASS Steps 1, 2, 3, AND 4 (i.e. studies that possess a DIRECT, SPECIFIC, AND CONCRETE empirical overlap with the target thesis's topic, actors, institutions, or empirical phenomenon):

     a) HIGH_RISK_REPLICATION (Direct Originality Threat):
        - The candidate study addresses the EXACT SAME research core/problem, focusing on the SAME primary actors/institutions in the SAME empirical context, AND employs the SAME theoretical framework. (High risk of duplicating existing research).

     b) RELATED_THESIS (Contextual or Analytical Divergence):
        - The candidate study addresses the SAME core topic, actors, institutions, or empirical phenomenon, BUT employs a DIFFERENT theoretical framework, focuses on a DIFFERENT analytical angle/dimension, or operates in a DIFFERENT temporal/spatial era.

     c) REFERENCE_MATERIAL (Antecedent Historical & Empirical Reference):
        - The candidate study provides direct antecedent historical background, empirical baseline data, or domain-specific context directly related to the SAME target actors, institutions, or empirical subject matter (e.g., historical background of the same actors/region prior to the thesis timeline). Note: Pure abstract theory theses, theses about unrelated actors, or broad generic surveys MUST NOT be classified here; they are eliminated in Steps 1, 2 & 3.

  6. STEP 6: DEFAULT FALLBACK
     - Any study that fails the strict criteria above MUST be classified as OUT_OF_SCOPE.

- RELEVANCE DISCIPLINE:
  - Set isRelevant: true STRICTLY for HIGH_RISK_REPLICATION, RELATED_THESIS, and REFERENCE_MATERIAL.
  - Set isRelevant: false STRICTLY for OUT_OF_SCOPE.

- OUTPUT PROSE MANDATE:
  - relevanceExplanation: Rigorous, highly critical 1-2 sentence academic justification in Turkish. For OUT_OF_SCOPE candidates, explicitly state why the candidate lacks direct relevance (e.g., "Bu çalışma genelleştirilmiş bir [Tematik Alan Z] taraması sunmakta olup, hedef tezin odağındaki spesifik aktör [Aktör B] ve [Analiz Odağı] konularını incelemediği için OUT_OF_SCOPE olarak elenmiştir.").
  - uniquenessGap: Deep analysis of the literature gap/difference for HIGH_RISK_REPLICATION and RELATED_THESIS ONLY. For REFERENCE_MATERIAL and OUT_OF_SCOPE, write strictly "N/A".
  - literatureIntegration: Concrete usage guidelines (e.g., "Bölüm 2 / Kuramsal Çerçeve'de ... kavramı tartışılırken atıflanmalı") for HIGH_RISK_REPLICATION, RELATED_THESIS, and REFERENCE_MATERIAL. For OUT_OF_SCOPE, write strictly "N/A".

- OUTPUT FORMAT: Return a JSON array matching qualitativeAnalysisJsonSchema exactly.
</constraints>

<task>
Perform a deep originality audit and literature integration analysis using the Decision Tree pipeline above. Process each candidate thesis in isolation.
Return structured JSON matching the rules above.
</task>`;
}

export interface IngestedThesisCandidate {
  id: number;
  title: string;
  matrix: {
    researchCore: string;
    spatialContext: string;
    temporalContext: string;
    theoreticalFramework: string;
    methodology: string;
    mainClaim: string;
  };
}

/**
 * Kullanıcı tez matrisi ile aday tezlerin çıkarılmış matris detaylarını birleştirerek karşılaştırma promptunu oluşturur.
 * Statik ve dinamik verilerin ayrımı, bağlam önbellekleme (context caching) kurallarına ve
 * XML yapısal kapsülleme standartlarına uygundur.
 *
 * @param matrix - Kullanıcının kendi tezine ait araştırma matrisi
 * @param theses - Karşılaştırılacak olan aday tezlerin çıkarılmış matris listesi
 * @returns Kullanıcı sorgu prompt string'i
 */
export function buildQualitativePrompt(
  matrix: ThesisMatrix,
  theses: IngestedThesisCandidate[],
): string {
  const thesesXml = theses
    .map(
      (t) =>
        `<thesis>
<id>${t.id}</id>
<title>${t.title}</title>
<ingested_matrix>
<research_core>${t.matrix.researchCore}</research_core>
<spatial_context>${t.matrix.spatialContext}</spatial_context>
<temporal_context>${t.matrix.temporalContext}</temporal_context>
<theoretical_framework>${t.matrix.theoreticalFramework}</theoretical_framework>
<methodology>${t.matrix.methodology}</methodology>
<main_claim>${t.matrix.mainClaim}</main_claim>
</ingested_matrix>
</thesis>`,
    )
    .join("\n");

  return `<context>
<target_thesis_matrix>
<research_core>${matrix.researchCore}</research_core>
<target_actors>${matrix.targetActors}</target_actors>
<context>${matrix.context}</context>
<framework>${matrix.framework}</framework>
<main_claim>${matrix.mainClaim}</main_claim>
</target_thesis_matrix>

<candidate_theses>
${thesesXml}
</candidate_theses>
</context>

<task>
Read the target thesis matrix and compare it against each of the candidate theses in the context above in complete isolation.
Generate a structured JSON evaluation containing the audit report and literature integration guide for each candidate.
Write all textual explanations and guidelines in fluent, high-level Academic Turkish.
Return exactly ${theses.length} objects, one per thesis, in the same order as the candidate_theses list above.
Cevaplamadan önce çok derin düşün.
</task>`;
}

export const qualitativeAnalysisJsonSchema: JsonSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      thesisId: { type: "integer" },
      isRelevant: { type: "boolean" },
      originalityStatus: {
        type: "string",
        enum: [
          "HIGH_RISK_REPLICATION",
          "RELATED_THESIS",
          "REFERENCE_MATERIAL",
          "OUT_OF_SCOPE",
        ],
      },
      relevanceExplanation: {
        type: "string",
        description:
          "Tezin bu kategoriye atanmasının 1-2 cümlelik öz gerekçesi. Türkçe.",
      },
      uniquenessGap: {
        type: "string",
        description:
          "HIGH_RISK ve RELATED için: Çakışma riski ve kullanıcının tezini ayıran temel bilimsel fark (Literature Gap). REFERENCE ve OUT_OF_SCOPE için strictly 'N/A'. Türkçe.",
      },
      literatureIntegration: {
        type: "string",
        description:
          "HIGH_RISK, RELATED ve REFERENCE için: Bu tezin kullanıcının tezinde tam olarak hangi bölümde ve nasıl kullanılacağı rehberi. OUT_OF_SCOPE için strictly 'N/A'. Türkçe.",
      },
    },
    required: [
      "thesisId",
      "isRelevant",
      "originalityStatus",
      "relevanceExplanation",
      "uniquenessGap",
      "literatureIntegration",
    ],
    additionalProperties: false,
  },
};
