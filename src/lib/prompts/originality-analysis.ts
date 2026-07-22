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

- STRICT MATRIX GROUNDING (NO EXTRAPOLATION):
  - Base your evaluation and literature integration guide STRICTLY on the explicit parameters provided in the target thesis matrix (<target_thesis_matrix>).
  - Do NOT invent, extrapolate, or hallucinate non-existent research topics, unstated thesis chapters, or fictional connections between the candidate study and the target thesis.
  - If a candidate thesis does not clearly align with the explicit parameters in <target_thesis_matrix>, do NOT invent hypothetical usage scenarios.

- BALANCED SCOPE & DECISION TREE ELIMINATION PIPELINE (EVALUATE CANDIDATE IN THIS STRICT SEQUENCE):

  1. STEP 1: RESEARCH SUBJECT & FOCUS ALIGNMENT CHECK
     Inspect the target thesis matrix's primary research subjects / core entities (<target_actors> / <research_core>).
     - Does the candidate study focus primarily on DIFFERENT research entities, fundamentally different subject domains, or totally unrelated study objects?
     - IF YES (and it also lacks any shared theoretical framework/methodology) -> MUST classify immediately as OUT_OF_SCOPE.

  2. STEP 2: THEMATIC & ANALYTICAL AXIS CHECK
     Inspect the target thesis matrix's analytical problem (<research_core>) and theoretical framework (<framework>).
     - Does the candidate study focus on a DIFFERENT thematic axis, different problem statement, OR completely unrelated analytical field even if it belongs to the same broad academic discipline?
     - IF YES (and it has no theoretical/methodological overlap with the target) -> MUST classify immediately as OUT_OF_SCOPE.

  3. STEP 3: CATEGORIZATION OF ALIGNED STUDIES
     For studies that PASS Step 1 or Step 2 (aligned subject, theme, or foundational framework):

     a) HIGH_RISK_REPLICATION:
        - SAME timeframe/context, SAME primary target subjects/entities, AND SAME theoretical/methodological framework (Direct originality threat).

     b) RELATED_THESIS:
        - SAME timeframe/context AND SAME primary target subjects/entities, BUT employing a DIFFERENT theoretical framework or analytical angle (e.g., different methodology, theory, or sub-focus).

     c) REFERENCE_MATERIAL (FOUNDATIONAL & ANTECEDENT LITERATURE):
        - The candidate study belongs to a PRIOR historical timeframe, foundational conceptual era, OR establishes the foundational **Theoretical Framework** / **Methodology** explicitly specified in <framework> or <research_core>.
        - Mark as REFERENCE_MATERIAL ONLY if a researcher MUST cite it to establish the historical origins, conceptual genealogy, theoretical foundation, or literature baseline in the Literature Review / Introduction chapters.

  4. STEP 4: DEFAULT FALLBACK
     - Any candidate study that fails to demonstrate clear subject, thematic, or theoretical alignment with <target_thesis_matrix> MUST be classified as OUT_OF_SCOPE.

- RELEVANCE DISCIPLINE:
  - Set isRelevant: true STRICTLY for HIGH_RISK_REPLICATION, RELATED_THESIS, and REFERENCE_MATERIAL.
  - Set isRelevant: false STRICTLY for OUT_OF_SCOPE.

- OUTPUT PROSE MANDATE:
  - relevanceExplanation: 1-2 sentence concise justification for EVERY thesis in Academic Turkish, strictly grounded in the target matrix parameters without speculation.
  - uniquenessGap: Deep analysis for HIGH_RISK_REPLICATION and RELATED_THESIS ONLY. For REFERENCE_MATERIAL and OUT_OF_SCOPE, write strictly "N/A".
  - literatureIntegration: Concrete, realistic usage instructions (e.g., "Giriş veya Kuramsal Çerçeve bölümünde temel teorik altyapıyı kurarken kullanılmalı") for HIGH_RISK_REPLICATION, RELATED_THESIS, and REFERENCE_MATERIAL. For OUT_OF_SCOPE, write strictly "N/A".

- OUTPUT FORMAT: Return a JSON array matching qualitativeAnalysisJsonSchema exactly.
</constraints>

<task>
Perform a deep originality audit and literature integration analysis using the Decision Tree pipeline above. Process each candidate thesis in isolation.
Base all judgments strictly on the explicit context provided without speculating or inventing unstated connections.
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
