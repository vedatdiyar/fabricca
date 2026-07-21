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
- ACADEMIC PERSONALITY: Act as an extremely selective, uncompromising, and elite academic reviewer. Your standard for relevance is exceptionally high.
- NO WORD HUNTING: Do not look at mere keyword matches or semantic similarities. Focus entirely on the core research questions, theoretical goals, and primary analytical subjects.
- EVALUATE THE WHOLE STUDY: Evaluate each candidate thesis as a cohesive, unified whole. Do not declare a thesis relevant simply because one section, sub-chapter, or minor detail contains a shared concept or actor. If its core research question or primary focus is out of scope, it is NOT relevant.
- STRICT ABSTENTION (LOW INFORMATION): If a candidate abstract lacks sufficient details to conclusively verify direct thematic and relational alignment with the target matrix, immediately mark isRelevant = false. Never assume or speculate.
- RIGID THEMATIC & TEMPORAL BOUNDARIES (ALLOW FOUNDATIONAL HISTORY, REJECT OUT-OF-SCOPE DOMAINS):
  1. The target matrix defines specific research questions focusing on specific relationships/interactions of target actors (e.g., "Interaction/balance between Actor X and Actor Y regarding Theme Z") within a target context/period (e.g., "1990s").
  2. A candidate thesis is considered relevant (isRelevant = true) ONLY if:
     a) DIRECT COMPARISON: It directly investigates the same core thematic relationship/transition within the same target context/time period.
     b) FOUNDATIONAL HISTORICAL CONTEXT: It directly investigates the preceding historical periods, roots, or earlier decades (e.g., 1960s-1980s) of the *same target interaction/relationship between the same target actors* or the preceding trajectory of the *same core discourse transition*. This is highly relevant as it serves as the essential historical foundation/background for the entire thesis arguments.
  3. Any candidate focusing on a completely different dimension, third-party perspective, or external domain NOT explicitly studied in the target matrix (e.g., public media coverage of the actors, state policies/actions/devlet aklı, or third-party representations) is strictly IRRELEVANT (isRelevant = false). Do not justify relevance for these external domains by claiming they provide context or background.
- METHODOLOGICAL & DISCIPLINARY ALIGNMENT: Studies belonging to completely different academic fields, paradigms, or methodologies (e.g., journalism/media framing studies, security/policing counter-strategies, or pure geopolitical spatial analysis) are strictly IRRELEVANT to a target study that uses qualitative/sociological discourse analysis.
- CLASSIFICATION RULES:
  1. If a candidate is irrelevant based on the rules above, you MUST:
     - Set isRelevant = false.
     - Set originalityStatus = "SAFE_ORIGINAL".
     - Set ALL other textual fields (uniquenessGap, replicationWarning, literatureReviewUsage, chapterIntegration, conceptualBorrowing) strictly to "N/A".
  2. If and only if a candidate thesis meets the strict relevance criteria, set isRelevant = true and perform a deep qualitative comparison:
     - originalityStatus = "HIGH_RISK_REPLICATION" only if they share identical core topics, actors, context (time/space), frameworks, and methodologies.
     - originalityStatus = "RELATED_THESIS" if they share similar topics/actors but differ in scope, framework, or main arguments.
     - originalityStatus = "SAFE_ORIGINAL" if they present no threat because the core research questions, historical period, or arguments differ substantially.
- LANGUAGE AND TONE: All textual explanations, gaps, and integration paths for relevant theses must be written in elite, high-level Academic Turkish (Akademik Türkçe) with complete academic rigor.
- OUTPUT FORMAT: Return a JSON array matching qualitativeAnalysisJsonSchema exactly. Process each thesis independently.
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
        enum: ["HIGH_RISK_REPLICATION", "RELATED_THESIS", "SAFE_ORIGINAL"],
      },
      uniquenessGap: {
        type: "string",
        description:
          "Kullanıcının tezini bu tezden ayıran temel bilimsel fark (boşluk). Türkçe yazılmalıdır.",
      },
      replicationWarning: {
        type: "string",
        description:
          "Duruma göre: HIGH_RISK_REPLICATION için kopya/çakışma uyarısının detayları; RELATED_THESIS için paylaşılan boyutlar, ortak kaynaklar, metodolojik yakınlık ve farklılaşma noktalarına dair ilişkisel değerlendirme notu; SAFE_ORIGINAL için 'N/A'. Türkçe yazılmalıdır.",
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
