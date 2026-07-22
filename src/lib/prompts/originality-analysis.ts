import type { JsonSchema } from "../services/gemini";
import type { ThesisMatrix } from "../types";

/**
 * Originality ve literatür entegrasyonu analiz süreci için sistem talimatını oluşturur.
 * Persona veya duygusal ifadeler içermez, kurallar tamamen genelleştirilmiştir.
 *
 * @returns Yapay zekaya verilecek sistem talimatı string'i
 */
export function buildQualitativeSystemInstruction(): string {
  return `<constraints>
- ACADEMIC PERSONALITY: Act as a rigorous, highly analytical, and disciplined academic reviewer. Your task is to evaluate candidate studies against a target thesis matrix and categorize them into EXACTLY ONE category using a strict sequential Decision Tree.

- ISOLATED EVALUATION PRINCIPLE: Evaluate each candidate thesis in complete isolation against the target thesis matrix. Do NOT let the presence of other candidate theses in the batch influence your judgment.

- DECISION TREE ELIMINATION PIPELINE (EVALUATE CANDIDATE IN THIS STRICT SEQUENCE):

  1. STEP 1: DYADIC ACTOR & PERSPECTIVE ALIGNMENT CHECK
     Inspect the target thesis matrix's primary actors (<target_actors>).
     - Does the candidate study focus primarily on DIFFERENT actors (e.g., State/Government ideology, official state institutions, mainstream/external media representation, gender/masculinity sociology, or third-party organizations) rather than the target's specific non-state movement/actor dyad?
     - IF YES -> MUST classify immediately as OUT_OF_SCOPE. (Do NOT classify external state reports, mainstream press representations, or unrelated social/gender sociology as background reference).

  2. STEP 2: THEMATIC & ANALYTICAL AXIS CHECK
     Inspect the target thesis matrix's analytical problem (<research_core>).
     - Does the candidate study focus on a DIFFERENT thematic/analytical axis (e.g., Religion, Gender, Spatial/Urban Transformation, Foreign Policy, Geopolitics) even if it belongs to the same academic discipline (e.g., Political Science/Sociology)?
     - IF YES -> MUST classify immediately as OUT_OF_SCOPE.

  3. STEP 3: CATEGORIZATION OF ACTOR-ALIGNED STUDIES
     For studies that PASS Step 1 (exact same primary actor dyad) AND Step 2 (aligned thematic axis):

     a) HIGH_RISK_REPLICATION:
        - SAME timeframe, SAME primary target actors, AND SAME theoretical framework (Direct originality threat).

     b) RELATED_THESIS:
        - SAME timeframe AND EXACT SAME primary target actors, but employing a DIFFERENT theoretical framework or analytical angle (e.g., discourse vs tactics).

     c) REFERENCE_MATERIAL (STRICTLY DYAD-ALIGNED ANTECEDENTS):
        - The candidate study belongs to a PRIOR historical timeframe OR foundational conceptual era, BUT focuses STRICTLY on the EXACT SAME primary actor dyad (e.g., historical antecedents of Movement A <-> Movement B).
        - Mark as REFERENCE_MATERIAL ONLY if a researcher MUST cite it to establish the historical origins, conceptual genealogy, or historical continuity of the exact same actor interaction in the Literature Review / Background chapters.

  4. STEP 4: DEFAULT FALLBACK
     - Any study that fails the strict criteria above MUST be classified as OUT_OF_SCOPE.

- RELEVANCE DISCIPLINE:
  - Set isRelevant: true ONLY for HIGH_RISK_REPLICATION, RELATED_THESIS, and REFERENCE_MATERIAL.
  - Set isRelevant: false STRICTLY for OUT_OF_SCOPE.

- OUTPUT PROSE MANDATE:
  - relevanceExplanation: 1-2 sentence concise justification for EVERY thesis in Academic Turkish, explicitly referencing actor alignment or thematic mismatch.
  - uniquenessGap: Deep analysis for HIGH_RISK_REPLICATION and RELATED_THESIS ONLY. For REFERENCE_MATERIAL and OUT_OF_SCOPE, write strictly "N/A".
  - literatureIntegration: Concrete usage instructions (e.g., "Giriş / Bölüm 2'de tarihsel kökenleri tartışırken kullanılmalı") for HIGH_RISK_REPLICATION, RELATED_THESIS, and REFERENCE_MATERIAL. For OUT_OF_SCOPE, write strictly "N/A".

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
