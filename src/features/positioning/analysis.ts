import { ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { FLASH_36, GEMINI_SEED } from "@/lib/constants";
import { getGeminiKeyPool } from "@/services/ai/gemini-key-pool";
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
      "Tezin stratejik rolü: UMBRELLA_MACRO | PARALLEL_LINE | SEQUENTIAL_PERIOD | DIRECT_CHALLENGE",
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

/** Zod schema for the LLM jury analysis output. */
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

/** Inferred type for the LLM jury analysis result. */
export type JuryAnalysisResult = z.infer<typeof juryAnalysisResultSchema>;

/** JSON Schema for Gemini structured outputs. */
export const juryAnalysisResultJsonSchema: JsonSchema = {
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
    recommendedTheses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          externalThesisId: {
            type: "string",
            description: "Tezin ID'si",
          },
          title: { type: "string", description: "Tezin başlığı" },
          author: { type: "string", description: "Tezin yazarı" },
          year: { type: "number", description: "Tezin yılı" },
          university: { type: "string", description: "Tezin üniversitesi" },
          strategicRole: {
            type: "string",
            enum: [
              "BROAD_CONTEXT",
              "SPECIFIC_FOCUS",
              "FOUNDATIONAL_WORK",
              "METHODOLOGICAL_BENCHMARK",
              "ALTERNATIVE_PERSPECTIVE",
            ],
            description:
              "Tezin stratejik rolü: BROAD_CONTEXT (Geniş Çerçeve), SPECIFIC_FOCUS (Kısmi Odak), FOUNDATIONAL_WORK (Öncül Çalışma), METHODOLOGICAL_BENCHMARK (Yöntem Rehberi), ALTERNATIVE_PERSPECTIVE (Karşıt Yaklaşım)",
          },
          literaturePosition: {
            type: "string",
            description:
              "Tezin literatürdeki yerini ve ne yaptığını anlatan 1 net cümle",
          },
          contributionArea: {
            type: "string",
            description:
              "Tezin kullanıcının matrisinde odaklandığı spesifik alan",
          },
          relevanceReason: {
            type: "string",
            description:
              "Kullanıcının bu tezi Giriş ve Literatür bölümlerinde nasıl kaynak olarak kullanacağına ve tezin hangi boşluğunu dolduracağına dair stratejik rehber not.",
          },
        },
        required: [
          "externalThesisId",
          "title",
          "author",
          "year",
          "university",
          "strategicRole",
          "literaturePosition",
          "contributionArea",
          "relevanceReason",
        ],
        additionalProperties: false,
      },
      description:
        "Ön elemeden geçerek jüriye sunulan ilgili rehber tezlerin listesi",
    },
  },
  required: ["globalStatus", "gapAnalysisSummary", "recommendedTheses"],
  additionalProperties: false,
};

/**
 * Runs the final synthesis jury LLM over the relevant evaluated theses in a single Gemini call.
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
Katkı/Odak Alanları: ${e.contributionAreas.join(", ") || "Yok"}
Özet: ${t.abstract}`;
    })
    .join("\n\n---\n\n");

  const payload = buildPositioningJuryPromptPayload({
    input,
    thesisListText,
    evaluatedCount: evaluatedTheses.length,
  });

  const result = await generateGeminiStructuredContent<JuryAnalysisResult>(
    FLASH_36,
    payload.systemInstruction,
    payload.userPrompt,
    juryAnalysisResultJsonSchema,
    logger,
    {
      zodSchema: juryAnalysisResultSchema,
      payloadStage: "positioning_jury_analysis",
      seed: GEMINI_SEED,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      thesisMatrix: { input, filteredThesesCount: evaluatedTheses.length },
      apiKey: getGeminiKeyPool().keys[2] ?? getGeminiKeyPool().keys[0],
    },
  );

  if (overlapping) {
    result.globalStatus = "DIRECT_OVERLAP";
  }

  return result;
}
