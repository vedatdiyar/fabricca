import { ThinkingLevel } from "@google/genai";
import { FLASH_36, GEMINI_SEED } from "@/lib/constants";
import { generateGeminiStructuredContent } from "@/services/ai";
import type { Logger } from "@/lib/logger";
import { buildPositioningJuryPromptPayload } from "./prompts/jury-analysis.prompt";
import type { EvaluatedThesis } from "./per-thesis-evaluation";
import type { PositioningMatrixInput } from "./validation";
import {
  juryRecommendedThesisSchema,
  juryAnalysisResultSchema,
  jurySynthesisResultSchema,
  jurySynthesisResultJsonSchema,
  type JuryRecommendedThesis,
  type JuryAnalysisResult,
  type JurySynthesisResult,
} from "./analysis-schemas";
import { mapRecommendedTheses } from "./analysis-mapper";

export {
  juryRecommendedThesisSchema,
  juryAnalysisResultSchema,
  jurySynthesisResultSchema,
  jurySynthesisResultJsonSchema,
  type JuryRecommendedThesis,
  type JuryAnalysisResult,
  type JurySynthesisResult,
  mapRecommendedTheses,
};

/**
 * Runs the final synthesis jury LLM over the relevant evaluated theses to produce
 * the global status and gap analysis in a single focused Gemini call. The
 * recommended guiding thesis cards are assembled deterministically in TypeScript
 * from the evaluated theses, keeping the LLM output lean and fast.
 *
 * @param input - The validated positioning matrix input.
 * @param evaluatedTheses - The relevant evaluated theses to synthesize (irrelevant ones already dropped).
 * @param logger - Optional structured logger for pipeline events.
 * @returns The structured jury analysis result.
 */
export async function analyzePositioningJury(
  input: PositioningMatrixInput,
  evaluatedTheses: EvaluatedThesis[],
  logger?: Logger,
): Promise<JuryAnalysisResult> {
  const overlapping = evaluatedTheses.some(
    (ev) => ev.evaluation.isDirectOverlap,
  );

  if (evaluatedTheses.length === 0) {
    logger?.info("positioning_jury_no_theses", {
      service: "positioning",
      filePath: "src/features/positioning/analysis.ts",
      data: { inputSubject: input.subjectProblem },
    });

    return {
      globalStatus: "NO_RELATED_LITERATURE",
      gapAnalysisSummary: {
        literatureMapping:
          "Veritabanında girilen tez matrisiyle doğrudan ilişkilendirilebilecek herhangi bir akademik teze rastlanmamıştır.",
        academicGap:
          "Doğrudan eşleşen bir çalışma bulunmadığı için mevcut literatürde tespit edilmiş bir çakışma veya doymuşluk alanı bulunmamaktadır.",
        originalContribution:
          "Çalışmanız literatürde henüz işlenmemiş son derece bakir ve yüksek özgünlüğe sahip bir alanda konumlanmaktadır.",
      },
      recommendedTheses: [],
    };
  }

  const thesisListText = evaluatedTheses
    .map((ev, idx) => {
      const t = ev.thesis;
      const e = ev.evaluation;
      return `[Tez #${idx + 1}] ID: ${t.id}
Başlık: ${t.title}
Yazar: ${t.author || "Bilinmiyor"} (${t.year || "N/A"})
Üniversite/Bölüm: ${t.university || "N/A"} - ${t.department || "N/A"}
Tür: ${t.thesisType || "N/A"} | Dil: ${t.language || "N/A"}
Birebir Örtüşme: ${e.isDirectOverlap ? "EVET" : "HAYIR"}
Stratejik Rol: ${e.strategicRole || "UMBRELLA_MACRO"}
Literatürdeki Yeri (Ne Yaptı?): ${e.literaturePosition || "N/A"}
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
    FLASH_36,
    payload.systemInstruction,
    payload.userPrompt,
    jurySynthesisResultJsonSchema,
    logger,
    {
      zodSchema: jurySynthesisResultSchema,
      payloadStage: "positioning_jury_analysis",
      seed: GEMINI_SEED,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      thesisMatrix: { input, filteredThesesCount: evaluatedTheses.length },
      quiet: true,
    },
  );

  if (overlapping) {
    synthesis.globalStatus = "DIRECT_OVERLAP";
  }

  return {
    globalStatus: synthesis.globalStatus,
    gapAnalysisSummary: synthesis.gapAnalysisSummary,
    recommendedTheses: mapRecommendedTheses(evaluatedTheses),
  };
}
