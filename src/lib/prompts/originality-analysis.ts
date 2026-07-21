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
- NO WORD HUNTING: Evaluate the actual focus, research questions, and analytical subject of the study, not just the keywords.
- THEMATIC FOCUS AND BOUNDARIES: In academic disciplines, studies focusing on completely different dimensions, thematic areas, or analytical subjects (even if they analyze the same actors, data sources, or organizations) are NOT considered relevant to the target study's specific thematic focus and research questions.
- For each candidate:
  1. If the candidate thesis studies a completely different phenomenon (e.g., different thematic focus, different analytical subject, unrelated actors), set isRelevant = false, originalityStatus = "SAFE_ORIGINAL", and fill other fields with "N/A".
  2. If the candidate thesis studies the same actor groups and a related thematic focus or research topic, set isRelevant = true, evaluate the originality status, explain the uniqueness gap, and provide literature/chapter usage guidelines in fluent Academic Turkish.
  3. Use the following originalityStatus classifications:
     - HIGH_RISK_REPLICATION: If the candidate thesis shares the same core topic, same actors, same context (time/space), same theoretical framework, and methodology. This indicates a high risk of duplicate work.
     - POTENTIAL_OVERLAP: If the candidate thesis has a very similar topic or actors but differs in its primary thesis/arguments, scope, or framework.
     - SAFE_ORIGINAL: If the candidate thesis poses no replication threat because it differs substantially in its core research questions, time period, or primary thesis.
  4. For chapterIntegration, map the literature directly to standard thesis chapters:
     - Giriş ve Literatür Taraması (for gap/contextual placement)
     - Kuramsal Tartışma (for framing comparisons)
     - Ampirik Analiz ve Bulgular (for empirical comparisons)
  5. Write all textual explanations and guidelines in fluent, high-level Academic Turkish.
- ÇIKTI FORMATI: qualitativeAnalysisJsonSchema ile %100 uyumlu bir JSON array döndürün. Her tezi bağımsız olarak işleyin.
</constraints>

<task>
Perform an originality audit and a literature integration analysis for candidate theses against a target thesis matrix. Read the target thesis matrix and compare it against each of the candidate theses to generate a structured evaluation containing the audit report and literature integration guide. Write all textual explanations and guidelines in fluent, high-level Academic Turkish.
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
Read the target thesis matrix and compare it against each of the candidate theses in the context above (using their ingested matrices).
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
        enum: ["HIGH_RISK_REPLICATION", "POTENTIAL_OVERLAP", "SAFE_ORIGINAL"],
      },
      uniquenessGap: {
        type: "string",
        description:
          "Kullanıcının tezini bu tezden ayıran temel bilimsel fark (boşluk). Türkçe yazılmalıdır.",
      },
      replicationWarning: {
        type: "string",
        description:
          "Eğer kopya riski varsa uyarının detayları, yoksa 'N/A'. Türkçe yazılmalıdır.",
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
