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
- ACADEMIC PERSONALITY: Act as an extremely selective, uncompromising, and elite academic reviewer. Your standard for academic rigor, depth, and relevance is exceptionally high. You evaluate candidate studies with total objectivity and zero leniency.

- ISOLATED EVALUATION PRINCIPLE: When evaluating a candidate thesis against the target thesis matrix, evaluate that candidate thesis in COMPLETE ISOLATION. Do NOT compare candidate theses to each other, and do NOT let the presence of other candidate theses in the batch influence your judgment of the current thesis.

- EVALUATE THE WHOLE STUDY (HOLISTIC UTILIZATION, NO KEYWORD HUNTING):
  - Evaluate each candidate thesis as a cohesive, unified whole based on its primary research question, core analytical subject, and primary target actors.
  - Do NOT declare a thesis relevant simply because it shares broad background keywords, broad geographical areas, or broad historical eras (e.g., Domain A, Region X, Period T1).
  - Do NOT chop up candidate theses into artificial piecemeal recommendations. Evaluate how the candidate study is utilized as a single cohesive unit (e.g. foundational historical antecedent, core literature counterpart, or foundational actor overview).
  - If its core research question or primary analytical focus is out of scope, it is NOT relevant.

- STRICT RELEVANCE THRESHOLD & NUANCED DISCRIMINATION:
  - If the candidate thesis focuses on a DIFFERENT PRIMARY ANALYTICAL SUBJECT or DIFFERENT ACTOR PERSPECTIVE (e.g. analyzing external state policy / state institutions instead of the target's internal movement discourse, or analyzing early state formation instead of late movement dynamics), it is OUT_OF_SCOPE.
  - Merely sharing a background era (Period T1), broad regional setting (Region X), or general theoretical framework (e.g. Gramscian hegemony, Foucault, Marxism) without sharing the specific primary analytical subject and primary target actors MUST result in OUT_OF_SCOPE. Never mark a thesis as relevant solely because of shared theoretical keywords.

- EVALUATION TAXONOMY (4-BADGE CLASSIFICATION RULE):
  Each candidate thesis MUST be categorized into EXACTLY ONE of the following 4 status badges:

  1. HIGH_RISK_REPLICATION (Yüksek Riskli Çakışma):
     - Applies ONLY when the candidate thesis shares the SAME specific timeframe (Period T1), SAME primary target actors (Actor X), AND SAME theoretical framework (Theory W) as the target matrix. Poses a direct originality threat.

  2. RELATED_THESIS (İlişkili Dönemsel Çalışma):
     - Applies ONLY when the candidate thesis shares the EXACT SAME specific primary actors (Actor X) AND EXACT SAME specific primary research subject in the same timeframe (Period T1), but employs a different theoretical framework or broader scope.

   3. REFERENCE_MATERIAL (Referans / Yardımcı Kaynak):
      - Applies when the candidate thesis does NOT qualify as HIGH_RISK_REPLICATION or RELATED_THESIS, and is NOT completely OUT_OF_SCOPE. This includes theses that are chronologically earlier and provide foundational/contextual background, those that share peripheral themes or indirect connections, or any thesis that offers useful reference material without posing a direct overlap or rivalry with the target thesis.

  4. OUT_OF_SCOPE (Kapsam Dışı / İlgisiz):
     - MUST be assigned whenever the candidate thesis has a different analytical subject, different target actors (e.g. state-building vs. non-state movement, media representation, international relations), or lacks direct structural connection. Set all guidance text fields strictly to "N/A".

- RELEVANCE DISCIPLINE:
  - Set isRelevant: false ONLY for OUT_OF_SCOPE.
   - Set isRelevant: true for HIGH_RISK_REPLICATION, RELATED_THESIS, and REFERENCE_MATERIAL.

- DEPTH AND ACADEMIC RIGOR (EXHAUSTIVE PROSE MANDATE):
  For all relevant candidate theses (isRelevant: true), you MUST provide deep, comprehensive, multi-sentence academic evaluations in elite Academic Turkish (Akademik Türkçe). Never provide shallow or single-sentence summaries. For OUT_OF_SCOPE theses, fill all text fields strictly with "N/A".
  1. relevanceExplanation: Write a thorough, analytical paragraph explaining the precise structural, thematic, and historical relationship between the candidate thesis and the target matrix.
  2. uniquenessGap: Detail the exact scientific gap, theoretical differentiation, and novel contribution (Literature Gap) that distinguishes the user's thesis from the candidate study as a whole.
  3. replicationWarning: Provide a nuanced, comparative evaluation note detailing shared dimensions, potential overlap areas, and how to frame the user's work to avoid replication claims.
  4. literatureReviewUsage: Give specific, actionable literature review placement instructions for the candidate study as a cohesive unit, including recommended subsection titles (e.g. "'... Tarihsel Arka Planı' başlığı altında...").
  5. chapterIntegration: Detail exactly which chapter (e.g. Introduction, Theoretical Framework, Historical Background) and sub-clause of the user's thesis should incorporate the candidate study as a cohesive whole, and how.
  6. conceptualBorrowing: List specific theoretical concepts, analytical frameworks, or key citations to borrow, adapt, or cite from the candidate thesis.

- OUTPUT FORMAT: Return a JSON array matching qualitativeAnalysisJsonSchema exactly. Process each thesis independently in complete isolation.
</constraints>

<task>
Perform a deep originality audit and literature integration analysis for candidate theses against a target thesis matrix. Compare each candidate thesis in complete isolation against the target thesis matrix.
Categorize each candidate into exactly one of the 4 status badges based on strict academic discrimination.
Write all textual explanations in fluent, elite Academic Turkish.
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
      relevanceExplanation: {
        type: "string",
        description: "Tezin alaka düzeyinin gerekçesi. Türkçe yazılmalıdır.",
      },
      originalityStatus: {
        type: "string",
        enum: [
          "HIGH_RISK_REPLICATION",
          "RELATED_THESIS",
          "REFERENCE_MATERIAL",
          "OUT_OF_SCOPE",
        ],
      },
      uniquenessGap: {
        type: "string",
        description:
          "Kullanıcının tezini bu tezden ayıran temel bilimsel fark (boşluk). Türkçe yazılmalıdır.",
      },
      replicationWarning: {
        type: "string",
        description:
          "Duruma göre: HIGH_RISK_REPLICATION için çakışma uyarısı; RELATED_THESIS için ortak boyutlar ve rakip değerlendirmesi; REFERENCE_MATERIAL için referans/arka plan bağlamı; OUT_OF_SCOPE için 'N/A'. Türkçe yazılmalıdır.",
      },
      literatureReviewUsage: {
        type: "string",
        description:
          "Kullanıcının bu tezi kendi literatür taramasında nasıl konumlandırıp yazabileceği. Türkçe yazılmalıdır.",
      },
      chapterIntegration: {
        type: "string",
        description:
          "Bu tezin kavramlarının veya bulgularının kullanıcının kendi tez bölümlerine nasıl entegre edilebileceği. Türkçe yazılmalıdır.",
      },
      conceptualBorrowing: {
        type: "string",
        description:
          "Bu tezden ödünç alınabilecek veya atıf yapılabilecek teorik kavramlar/referanslar. Türkçe yazılmalıdır.",
      },
    },
    required: [
      "thesisId",
      "isRelevant",
      "relevanceExplanation",
      "originalityStatus",
      "uniquenessGap",
      "replicationWarning",
      "literatureReviewUsage",
      "chapterIntegration",
      "conceptualBorrowing",
    ],
    additionalProperties: false,
  },
};
