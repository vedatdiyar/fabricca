import { z } from "zod";
import type { JsonSchema } from "@/core/services/ai";
import {
  strategicRoleEnum,
  gapAnalysisStructuredSchema,
  type PositioningGlobalStatus,
  type GapAnalysisStructured,
} from "./validation";

/** Zod schema for a single evaluated thesis. */
export const perThesisEvaluationSchema = z.object({
  externalThesisId: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .describe("Değerlendirilen tezin veritabanı ID'si"),
  isRelevant: z
    .boolean()
    .describe(
      "Aday tez kullanıcının 3 bileşenli tez matrisi (Problem, Kuram, Yöntem) için doğrudan kuramsal, yöntemsel veya ampirik bir muhatap mıdır?",
    ),
  relevanceReasoning: z
    .string()
    .optional()
    .describe(
      "Tezin neden ilgili olduğuna veya literatürdeki yerine dair somut akademik gerekçe (1-2 cümle)",
    ),
  isDirectOverlap: z
    .boolean()
    .describe(
      "Kullanıcının tezi ile bu tez arasında birebir konu/yöntem/kapsam çakışması (özgünlük riski) var mı?",
    ),
  strategicRole: strategicRoleEnum
    .optional()
    .describe(
      "Tezin kullanıcının çalışmasındaki stratejik rolü: FOUNDATIONAL_WORK | METHODOLOGICAL_BENCHMARK | SPECIFIC_FOCUS | ALTERNATIVE_PERSPECTIVE",
    ),
  publicationType: z
    .enum(["Tez", "Makale", "Kitap", "Kitap Bölümü", "Rapor"])
    .optional()
    .default("Makale")
    .describe("Yayın türü: Tez, Makale, Kitap, Kitap Bölümü veya Rapor"),
  contributionAreas: z
    .array(z.string())
    .describe(
      "Tezin temas ettiği veya katkı sunduğu 1-2 spesifik akademik odak etiketi.",
    ),
  literaturePosition: z
    .string()
    .describe("Tezin literatürdeki yeri ve neyi incelediği (1 net cümle)"),
  strategicUtility: z
    .string()
    .describe(
      "Bu tezin araştırmacının tezinde nasıl konumlandırılacağı ve hangi boşluğun doldurulacağına dair stratejik not (1-2 cümle)",
    ),
});

export type PerThesisEvaluation = z.infer<typeof perThesisEvaluationSchema>;

/** Zod schema for batch thesis evaluation output. */
export const batchThesisEvaluationSchema = z.object({
  evaluations: z.array(perThesisEvaluationSchema),
});

export type BatchThesisEvaluationOutput = z.infer<
  typeof batchThesisEvaluationSchema
>;

/** JSON Schema for batch per-thesis evaluation matching batchThesisEvaluationSchema. */
export const batchThesisEvaluationJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    evaluations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          externalThesisId: {
            type: "string",
            description: "Değerlendirilen tezin ID'si",
          },
          isRelevant: {
            type: "boolean",
            description:
              "Aday tez kullanıcının 3 bileşenli tez matrisi için doğrudan kuramsal, yöntemsel veya ampirik muhatap mıdır?",
          },
          relevanceReasoning: {
            type: "string",
            description:
              "Tezin neden ilgili olduğuna dair somut akademik gerekçe (1-2 cümle)",
          },
          isDirectOverlap: {
            type: "boolean",
            description:
              "Kullanıcının tezi ile birebir çakışma (özgünlük riski) var mı?",
          },
          publicationType: {
            type: "string",
            enum: ["Tez", "Makale", "Kitap", "Kitap Bölümü", "Rapor"],
            description:
              "Yayın türü: Tez, Makale, Kitap, Kitap Bölümü veya Rapor",
          },
          strategicRole: {
            type: "string",
            enum: [
              "FOUNDATIONAL_WORK",
              "METHODOLOGICAL_BENCHMARK",
              "SPECIFIC_FOCUS",
              "ALTERNATIVE_PERSPECTIVE",
            ],
            description:
              "Tezin stratejik rolü: FOUNDATIONAL_WORK (Öncül Çalışma), METHODOLOGICAL_BENCHMARK (Yöntem Referansı), SPECIFIC_FOCUS (Kısmi Odak), ALTERNATIVE_PERSPECTIVE (Karşıt Yaklaşım).",
          },
          contributionAreas: {
            type: "array",
            items: { type: "string" },
            description:
              "Tezin temas ettiği spesifik odak alanları (1-2 kısa etiket).",
          },
          literaturePosition: {
            type: "string",
            description:
              "Tezin literatürdeki konumu ve ne yaptığı (1 net cümle).",
          },
          strategicUtility: {
            type: "string",
            description:
              "Tezin araştırmacı tarafından nasıl kullanılacağına dair stratejik kullanım notu (1-2 cümle).",
          },
        },
        required: [
          "externalThesisId",
          "isRelevant",
          "isDirectOverlap",
          "strategicRole",
          "contributionAreas",
          "literaturePosition",
          "strategicUtility",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["evaluations"],
  additionalProperties: false,
};

/** Zod schema for the final jury synthesis LLM output. */
export const jurySynthesisResultSchema = z.object({
  globalStatus: z.enum([
    "DIRECT_OVERLAP",
    "NOVEL_GAP_IDENTIFIED",
    "NO_RELATED_LITERATURE",
  ]),
  gapAnalysisSummary: gapAnalysisStructuredSchema,
  selectedThesisIds: z.array(z.string()).optional(),
});

export type JurySynthesisResult = z.infer<typeof jurySynthesisResultSchema>;

/** JSON schema for Gemini structured output for jury synthesis. */
export const jurySynthesisResultJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    globalStatus: {
      type: "string",
      enum: ["DIRECT_OVERLAP", "NOVEL_GAP_IDENTIFIED", "NO_RELATED_LITERATURE"],
      description:
        "Jürinin genel özgünlük kararı: NOVEL_GAP_IDENTIFIED (Özgün Katkı / Boşluk Mevcut), DIRECT_OVERLAP (Birebir Çakışma / Özgünlük Riski), NO_RELATED_LITERATURE (Bakir Alan / İlgili Tez Bulunamadı).",
    },
    gapAnalysisSummary: {
      type: "object",
      properties: {
        literatureMapping: {
          type: "string",
          description:
            "Mevcut Literatürün Haritalandırılması: İncelenen tez ve makalelerin hangi kuramsal ve ampirik alanlarda yoğunlaştığının akademik analizi (Markdown).",
        },
        academicGap: {
          type: "string",
          description:
            "Literatürdeki Boşluk: İncelenen çalışmaların neleri ele almadığı, hangi boyutları açıkta bıraktığının analizi (Markdown).",
        },
        originalContribution: {
          type: "string",
          description:
            "Çalışmanın Özgün Katkısı: Araştırmacının tezinin bu boşluğu problem, kuram ve yöntem açısından nasıl dolduracağının analizi (Markdown).",
        },
        overlappingWorks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              author: { type: "string" },
              year: { type: "number" },
              sourceType: { type: "string" },
              reason: {
                type: "string",
                description:
                  "Genel akademik çakışma gerekçesi ve ret tutanağı özeti.",
              },
              problemOverlap: {
                type: "string",
                description:
                  "Problem ve Sorunsal Düzeyinde Çakışma: Emsal çalışmayla kullanıcının araştırma problemi arasındaki birebir örtüşme gerekçesi.",
              },
              theoryOverlap: {
                type: "string",
                description:
                  "Kuramsal Çerçeve Düzeyinde Çakışma: Emsal çalışmayla kullanılan kavramsal ve teorik modeller arasındaki benzerlik gerekçesi.",
              },
              methodologyOverlap: {
                type: "string",
                description:
                  "Yöntemsel Desen Düzeyinde Çakışma: Emsal çalışmayla veri toplama, saha ve analiz yöntemleri arasındaki çakışma gerekçesi.",
              },
            },
            required: ["title", "sourceType", "reason"],
          },
          description:
            "Birebir çakışan veya yüksek özgünlük riski oluşturan emsal çalışma(lar) ve yapısal çakışma anatomisi.",
        },
        clarificationQuestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              question: { type: "string" },
              category: {
                type: "string",
                enum: ["scope", "focus", "methodology", "theoretical"],
              },
              contextNote: { type: "string" },
            },
            required: ["id", "question", "category", "contextNote"],
          },
          description:
            "Yalnızca tez kurgusunda gerçek bir kavramsal/kuramsal uyumsuzluk, olgusal hata, kritik kör nokta veya yapısal çelişki tespit edilmişse üretilen kritik netleştirme soruları (maksimum 1-2). Tez matrisi tutarlı ve sağlamsa bu dizi kesinlikle boş [] olmalıdır.",
        },
      },
      required: ["literatureMapping", "academicGap", "originalContribution"],
      additionalProperties: false,
    },
  },
  required: ["globalStatus", "gapAnalysisSummary"],
  additionalProperties: false,
};

/** Full positioning jury analysis result. */
export interface JuryAnalysisResult {
  globalStatus: PositioningGlobalStatus;
  gapAnalysisSummary: GapAnalysisStructured;
}
