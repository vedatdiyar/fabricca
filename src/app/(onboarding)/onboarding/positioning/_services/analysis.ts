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

  // Cap at 8 max recommended sources without artificial padding
  selectedItems = selectedItems.slice(0, 8);

  const recommendedTheses: RecommendedThesisItem[] = selectedItems.map((ev) => {
    const t = ev.thesis;
    const e = ev.evaluation;
    const pubType = e.publicationType || t.publicationType || "Makale";
    const isYok = t.sourceChannel === "yok";
    const yokId = String(t.id).replace("yok-", "");

    return {
      id: String(t.id),
      externalThesisId: String(t.id),
      title: t.title,
      author: t.author || "Bilinmiyor",
      year: t.year || new Date().getFullYear(),
      university: t.university || "Bilinmiyor",
      publicationType: pubType,
      sourceChannel: t.sourceChannel,
      strategicRole: e.strategicRole || "SPECIFIC_FOCUS",
      literaturePosition: e.literaturePosition,
      contributionArea:
        e.contributionAreas.join(", ") || "Literatür İncelemesi",
      relevanceReason: e.strategicUtility || e.relevanceReasoning || "",
      thesisType: pubType,
      abstract: t.abstract,
      url: t.url,
      doi: t.doi,
      yokUrl: isYok
        ? `https://tez.yok.gov.tr/UlusalTezMerkezi/tezDetay.jsp?id=${yokId}`
        : undefined,
    };
  });

  const finalGlobalStatus = overlapping
    ? "DIRECT_OVERLAP"
    : synthesis.globalStatus;

  // Ensure robust fallback for pivotOptions if DIRECT_OVERLAP occurred
  if (
    finalGlobalStatus === "DIRECT_OVERLAP" &&
    (!synthesis.gapAnalysisSummary.pivotOptions ||
      synthesis.gapAnalysisSummary.pivotOptions.length === 0)
  ) {
    synthesis.gapAnalysisSummary.pivotOptions = [
      {
        id: "field_pivot",
        dimension: "SAHA_ORNEKLEM",
        title: "Saha ve Örneklem Farklılaşması",
        description:
          "Emsal çalışmanın incelemediği farklı bir bölgesel bağlam, sektör veya spesifik aktör kümesine odaklanın.",
        suggestedFocus:
          "Farklı bir bölgesel veya sektörel örneklem ile özgün ampirik veri üretimi.",
      },
      {
        id: "theory_pivot",
        dimension: "KURAMSAL_CERCEVE",
        title: "Kuramsal Paradigma Farklılaşması",
        description:
          "Aynı olguyu emsal çalışmanın ana akım modelinden farklı, alternatif bir kuramsal mercekle ele alın.",
        suggestedFocus:
          "Alternatif bir kavramsal model ile olgunun farklı bir boyutunu aydınlatma.",
      },
      {
        id: "method_pivot",
        dimension: "YONTEMSEL_DESEN",
        title: "Yöntemsel Desen Farklılaşması",
        description:
          "Emsal çalışmanın yöntem sınırlarını aşarak nitel derinlemesine mülakat, arşiv veya karma desen kullanın.",
        suggestedFocus:
          "Daha derinlikli veya karşılaştırmalı bir araştırma yöntemi kurgulama.",
      },
    ];
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
          "Aynı konu, kuram veya yöntemsel kapsamda doğrudan örtüşme.",
      }));
  }

  return {
    globalStatus: finalGlobalStatus,
    gapAnalysisSummary: synthesis.gapAnalysisSummary,
    recommendedTheses,
  };
}
