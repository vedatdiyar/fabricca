import { ThinkingLevel } from "@google/genai";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import { generateGeminiStructuredContent } from "@/core/services/ai";
import type { Logger } from "@/lib/logger";
import { buildPositioningJuryPromptPayload } from "../_prompts/jury-analysis.prompt";
import type { EvaluatedThesis } from "./per-thesis-evaluation";
import type { PositioningMatrixInput } from "./validation";
import {
  jurySynthesisResultSchema,
  jurySynthesisResultJsonSchema,
  type JuryAnalysisResult,
  type JurySynthesisResult,
} from "./analysis-schemas";

export {
  jurySynthesisResultSchema,
  jurySynthesisResultJsonSchema,
  type JuryAnalysisResult,
  type JurySynthesisResult,
};

/**
 * Runs the final synthesis jury LLM over the relevant evaluated theses using FLASH_LITE_35.
 * Assembles the globalStatus, 3-dimensional gapAnalysisSummary, and recommended guiding theses.
 *
 * @param input - The validated positioning matrix.
 * @param evaluatedTheses - The relevant evaluated theses.
 * @param logger - Optional structured logger.
 * @returns The complete jury analysis result.
 */
export async function analyzePositioningJury(
  input: PositioningMatrixInput,
  evaluatedTheses: EvaluatedThesis[],
  logger?: Logger,
): Promise<JuryAnalysisResult> {
  const overlapping = evaluatedTheses.some(
    (ev) => ev.evaluation.isDirectOverlap,
  );

  // 0 Results Scenario: Return clean NO_RELATED_LITERATURE fallback
  if (evaluatedTheses.length === 0) {
    logger?.info("positioning_jury_no_theses", {
      service: "positioning",
      filePath:
        "src/app/(onboarding)/onboarding/positioning/_services/analysis.ts",
      data: { inputSubject: input.subjectProblem },
    });

    return {
      globalStatus: "NO_RELATED_LITERATURE",
      gapAnalysisSummary: {
        literatureMapping:
          "Ulusal tez merkezinde ve veri tabanında girilen tez matrisiyle (sorun, kuram, yöntem) doğrudan örtüşen veya aynı eksende konumlanan tamamlanmış bir akademik teze rastlanmamıştır.",
        academicGap:
          "Doğrudan eşleşen bir çalışma bulunmadığı için mevcut literatürde tespit edilmiş bir doymuşluk veya çakışma alanı tespit edilmemiştir.",
        originalContribution:
          "Çalışmanız literatürde henüz yeterince işlenmemiş, son derece bakir ve yüksek özgünlük potansiyeline sahip öncü bir alanda konumlanmaktadır.",
      },
      recommendedTheses: [],
    };
  }

  const thesisListText = evaluatedTheses
    .map((ev, idx) => {
      const t = ev.thesis;
      const e = ev.evaluation;
      const pubType =
        e.publicationType || t.publicationType || t.thesisType || "Makale";
      return `[Kaynak #${idx + 1}] ID: "${t.id}"
Başlık: ${t.title}
Yazar: ${t.author || "Bilinmiyor"} (${t.year || "N/A"})
Yayın Türü: ${pubType}
Kanal: ${t.sourceChannel}
Kurum/Yayıncı: ${t.university || "N/A"}
Birebir Çakışma: ${e.isDirectOverlap ? "EVET" : "HAYIR"}
Stratejik Rol: ${e.strategicRole || "SPECIFIC_FOCUS"}
Literatürdeki Yeri: ${e.literaturePosition || "N/A"}
Stratejik Kullanım / Boşluk Doldurma: ${e.strategicUtility || "N/A"}
Katkı/Odak Alanları: ${e.contributionAreas.join(", ") || "Yok"}`;
    })
    .join("\n\n---\n\n");

  const payload = buildPositioningJuryPromptPayload({
    input,
    thesisListText,
    evaluatedCount: evaluatedTheses.length,
  });

  const synthesis = await generateGeminiStructuredContent<JurySynthesisResult>(
    FLASH_LITE_35,
    payload.systemInstruction,
    payload.userPrompt,
    jurySynthesisResultJsonSchema,
    logger,
    {
      zodSchema: jurySynthesisResultSchema,
      payloadStage: "positioning_jury_synthesis",
      seed: GEMINI_SEED,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      thesisMatrix: input,
      quiet: true,
    },
  );

  const finalGlobalStatus = overlapping
    ? "DIRECT_OVERLAP"
    : synthesis.globalStatus;

  // Gatekeeper Model: Clear any pivot options to prevent superficial quick-fix illusions
  if (synthesis.gapAnalysisSummary.pivotOptions) {
    delete synthesis.gapAnalysisSummary.pivotOptions;
  }

  // Ensure overlappingWorks list is populated if direct overlap exists
  if (
    overlapping &&
    (!synthesis.gapAnalysisSummary.overlappingWorks ||
      synthesis.gapAnalysisSummary.overlappingWorks.length === 0)
  ) {
    synthesis.gapAnalysisSummary.overlappingWorks = evaluatedTheses
      .filter((ev) => ev.evaluation.isDirectOverlap)
      .map((ev) => ({
        title: ev.thesis.title,
        author: ev.thesis.author,
        year: ev.thesis.year,
        sourceType: ev.evaluation.publicationType || ev.thesis.publicationType,
        reason:
          ev.evaluation.relevanceReasoning ||
          "Aynı konu, kuram veya yöntemsel kapsamda doğrudan örtüşme tespit edilmiştir.",
        problemOverlap:
          ev.evaluation.literaturePosition ||
          "Araştırma sorunsalı ve ampirik problem odağında doğrudan örtüşme.",
        theoryOverlap: "Benzer kavramsal ve kuramsal modeller benimsenmiştir.",
        methodologyOverlap:
          "Benzer veri toplama aracı ve araştırma deseni kullanılmıştır.",
      }));
  }

  return {
    globalStatus: finalGlobalStatus,
    gapAnalysisSummary: synthesis.gapAnalysisSummary,
    recommendedTheses: [],
  };
}
