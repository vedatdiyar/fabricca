import { ThinkingLevel } from "@google/genai";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import { generateGeminiStructuredContent } from "@/core/services/ai";
import type { Logger } from "@/lib/logger";
import { buildPositioningJuryPromptPayload } from "../_prompts/jury-analysis.prompt";
import type { EvaluatedThesis } from "./per-thesis-evaluation";
import type {
  PositioningMatrixInput,
  RecommendedThesisItem,
} from "./validation";
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
      return `[Tez #${idx + 1}] ID: "${t.id}"
Başlık: ${t.title}
Yazar: ${t.author || "Bilinmiyor"} (${t.year || "N/A"})
Üniversite/Bölüm: ${t.university || "N/A"} - ${t.department || "N/A"}
Tür: ${t.thesisType || "N/A"}
Dil: ${t.language || "Türkçe"}
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

  // Map selected theses into RecommendedThesisItem[] strictly respecting the Jury's natural decision
  const evalByThesisId = new Map(
    evaluatedTheses.map((ev) => [String(ev.thesis.id), ev]),
  );

  let selectedItems: EvaluatedThesis[] = [];

  if (synthesis.selectedThesisIds && synthesis.selectedThesisIds.length > 0) {
    for (const id of synthesis.selectedThesisIds) {
      const found = evalByThesisId.get(String(id));
      if (
        found &&
        !selectedItems.some((s) => s.thesis.id === found.thesis.id)
      ) {
        selectedItems.push(found);
      }
    }
  }

  // Cap at 8 max recommended theses without artificial padding
  selectedItems = selectedItems.slice(0, 8);

  const recommendedTheses: RecommendedThesisItem[] = selectedItems.map((ev) => {
    const t = ev.thesis;
    const e = ev.evaluation;
    return {
      id: String(t.id),
      externalThesisId: String(t.id),
      title: t.title,
      author: t.author || "Bilinmiyor",
      year: t.year || new Date().getFullYear(),
      university: t.university || "Bilinmiyor",
      strategicRole: e.strategicRole || "SPECIFIC_FOCUS",
      literaturePosition: e.literaturePosition,
      contributionArea:
        e.contributionAreas.join(", ") || "Literatür İncelemesi",
      relevanceReason: e.strategicUtility || e.relevanceReasoning || "",
      thesisType: t.thesisType,
      abstract: t.abstract,
      tezaraUrl: `https://tez.yok.gov.tr/UlusalTezMerkezi/tezDetay.jsp?id=${t.id}`,
    };
  });

  const finalGlobalStatus = overlapping
    ? "DIRECT_OVERLAP"
    : synthesis.globalStatus;

  return {
    globalStatus: finalGlobalStatus,
    gapAnalysisSummary: synthesis.gapAnalysisSummary,
    recommendedTheses,
  };
}
