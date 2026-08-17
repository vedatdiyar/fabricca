import { ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { FLASH_36, GEMINI_SEED } from "@/lib/constants";
import {
  generateGeminiStructuredContent,
  type JsonSchema,
} from "@/services/ai";
import type { Logger } from "@/lib/logger";
import { buildPositioningJuryPromptPayload } from "./prompts/jury-analysis.prompt";
import type { EvaluatedThesis } from "./per-thesis-evaluation";
import {
  gapAnalysisStructuredSchema,
  strategicRoleEnum,
  type PositioningMatrixInput,
} from "./validation";

/** Zod schema for an individual recommended guiding thesis. */
export const juryRecommendedThesisSchema = z.object({
  externalThesisId: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .describe("Süzülen tez listesindeki tez ID'si"),
  title: z.string().describe("Tezin tam akademik başlığı"),
  author: z.string().describe("Tezin yazarı"),
  year: z.number().describe("Tezin hazırlanma yılı"),
  university: z.string().describe("Tezin sunulduğu üniversite"),
  strategicRole: strategicRoleEnum
    .optional()
    .describe(
      "Tezin stratejik rolü: BROAD_CONTEXT | SPECIFIC_FOCUS | FOUNDATIONAL_WORK | METHODOLOGICAL_BENCHMARK | ALTERNATIVE_PERSPECTIVE",
    ),
  literaturePosition: z
    .string()
    .optional()
    .describe("Tezin literatürdeki yerini ve ne yaptığını anlatan 1 net cümle"),
  contributionArea: z
    .string()
    .describe(
      "Tezin kullanıcının çalışmasında odaklandığı spesifik alan (Örn: Yasal Parti Söylemi ve Dönemselleştirme)",
    ),
  relevanceReason: z
    .string()
    .describe(
      "Kullanıcının bu tezi Giriş ve Literatür bölümlerinde nasıl kaynak olarak kullanacağına ve tezin hangi boşluğunu dolduracağına dair stratejik rehber not",
    ),
  doi: z.string().optional().describe("Tezin DOI adresi (varsa)"),
  thesisType: z
    .string()
    .optional()
    .describe("Tezin türü (Örn: Yüksek Lisans veya Doktora)"),
});

/** Inferred type for a single recommended guiding thesis card. */
export type JuryRecommendedThesis = z.infer<typeof juryRecommendedThesisSchema>;

/** Zod schema for the complete positioning report assembled after the LLM synthesis. */
export const juryAnalysisResultSchema = z.object({
  globalStatus: z.enum([
    "DIRECT_OVERLAP",
    "NOVEL_GAP_IDENTIFIED",
    "NO_RELATED_LITERATURE",
  ]),
  gapAnalysisSummary: gapAnalysisStructuredSchema,
  recommendedTheses: z
    .array(juryRecommendedThesisSchema)
    .describe(
      "Ön elemeden geçerek jüriye sunulan ilgili rehber tezlerin listesi.",
    ),
});

/** Inferred type for the jury analysis result. */
export type JuryAnalysisResult = z.infer<typeof juryAnalysisResultSchema>;

/** Zod schema for the focused LLM jury synthesis output — global status and gap analysis only. */
export const jurySynthesisResultSchema = z.object({
  globalStatus: z.enum([
    "DIRECT_OVERLAP",
    "NOVEL_GAP_IDENTIFIED",
    "NO_RELATED_LITERATURE",
  ]),
  gapAnalysisSummary: gapAnalysisStructuredSchema,
});

/** Inferred type for the LLM jury synthesis output. */
export type JurySynthesisResult = z.infer<typeof jurySynthesisResultSchema>;

/** JSON Schema for Gemini structured outputs of the focused jury synthesis. */
export const jurySynthesisResultJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    globalStatus: {
      type: "string",
      enum: ["DIRECT_OVERLAP", "NOVEL_GAP_IDENTIFIED", "NO_RELATED_LITERATURE"],
      description:
        "Yalnızca Konu + Teori + Analiz Birimi BİREBİR aynı ise DIRECT_OVERLAP verilir. Özgün katkı varsa NOVEL_GAP_IDENTIFIED verilir.",
    },
    gapAnalysisSummary: {
      type: "object",
      properties: {
        literatureMapping: {
          type: "string",
          description:
            "Mevcut Literatürün Haritalandırılması: Sunulan tezlerin araştırmanın hangi boyutlarını ele aldığının tematik haritası ve akademik özeti. Tezleri stratejik rollerine (Şemsiye, Paralel hat, Ardıl eşik) göre gruplayarak tematik özetle. Her tezden bahsederken mutlaka APA formatında atıf ver: (Yazar, Yıl).",
        },
        academicGap: {
          type: "string",
          description:
            "Literatürdeki Boşluk: İncelediğin tezlerin neleri göz ardı ettiği veya yetersiz kaldığı alanların analizi. Mutlaka APA atıflarıyla açıkla.",
        },
        originalContribution: {
          type: "string",
          description:
            "Çalışmanın Özgün Katkısı: Kullanıcının tez matrisinin bu boşluğu nasıl doldurduğu ve literatüre getirdiği akademik yenilik.",
        },
      },
      required: ["literatureMapping", "academicGap", "originalContribution"],
      additionalProperties: false,
      description: "3 sabit akademik sentez bölümü",
    },
  },
  required: ["globalStatus", "gapAnalysisSummary"],
  additionalProperties: false,
};

/**
 * Deterministically builds the recommended guiding thesis cards straight from the
 * evaluated theses — no LLM involvement. Direct-overlap theses are excluded per
 * the "Tam Kapsam" rule that previously lived in the prompt.
 *
 * @param evaluatedTheses - The relevant evaluated theses to convert into cards.
 * @returns The recommended guiding thesis items.
 */
function mapRecommendedTheses(
  evaluatedTheses: EvaluatedThesis[],
): JuryRecommendedThesis[] {
  return evaluatedTheses
    .filter((ev) => ev.evaluation.isRelevant && !ev.evaluation.isDirectOverlap)
    .map((ev) => {
      const t = ev.thesis;
      const e = ev.evaluation;
      return {
        externalThesisId: String(t.id),
        title: t.title,
        author: t.author,
        year: t.year,
        university: t.university,
        strategicRole: e.strategicRole ?? "BROAD_CONTEXT",
        literaturePosition: e.literaturePosition ?? "",
        contributionArea: e.contributionAreas.join(", ") || "",
        relevanceReason: e.strategicUtility ?? "",
        thesisType: t.thesisType,
      };
    });
}

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
