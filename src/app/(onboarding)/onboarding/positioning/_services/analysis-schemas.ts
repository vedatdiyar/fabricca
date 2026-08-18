import { z } from "zod";
import type { JsonSchema } from "@/core/services/ai";
import { gapAnalysisStructuredSchema, strategicRoleEnum } from "./validation";

/** Zod schema for Stage 1 binary triage single item output. */
export const binaryTriageItemSchema = z.object({
  externalThesisId: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .describe("Değerlendirilen tezin ID'si"),
  isRelevant: z
    .boolean()
    .describe(
      "Aday tez kullanıcının 3 bileşenli tez matrisi (Problem, Kuram, Yöntem) için doğrudan kuramsal, yöntemsel veya ampirik birincil muhatap mıdır?",
    ),
  decisionReason: z
    .string()
    .describe("Tezin kabul veya ret gerekçesini açıklayan 1-2 cümle"),
});

/** Inferred type for a single binary triage result. */
export type BinaryTriageItem = z.infer<typeof binaryTriageItemSchema>;

/** Zod schema for Stage 1 binary triage batch output. */
export const binaryTriageOutputSchema = z.object({
  evaluations: z.array(binaryTriageItemSchema),
});

/** Inferred type for batch binary triage output. */
export type BinaryTriageOutput = z.infer<typeof binaryTriageOutputSchema>;

/** JSON Schema for Gemini structured output in Stage 1 binary triage. */
export const binaryTriageJsonSchema: JsonSchema = {
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
              "Aday tez kullanıcının 3 bileşenli tez matrisi (Problem, Kuram, Yöntem) için doğrudan kuramsal, yöntemsel veya ampirik birincil muhatap mıdır? Dışsal medya analizi, izole alt tema, kronolojik sapma veya jenerik derleme varsa false.",
          },
          decisionReason: {
            type: "string",
            maxLength: 250,
            description: "Tezin kabul veya ret gerekçesini açıklayan 1-2 net cümle (maks 250 karakter)",
          },
        },
        required: ["externalThesisId", "isRelevant", "decisionReason"],
        additionalProperties: false,
      },
      description: "Batch içerisindeki her bir adayın ikili eleme sonuçları",
    },
  },
  required: ["evaluations"],
  additionalProperties: false,
};

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
      "Tezin stratejik rolü: SPECIFIC_FOCUS | FOUNDATIONAL_WORK | METHODOLOGICAL_BENCHMARK | ALTERNATIVE_PERSPECTIVE",
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
  abstract: z.string().optional().describe("Tezin Tezara'dan alınan özet metni"),
  tezaraUrl: z.string().optional().describe("Tezara sayfasının URL'si"),
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
          maxLength: 1200,
          description:
            "Mevcut Literatürün Haritalandırılması: Sunulan tezlerin araştırmanın hangi boyutlarını ele aldığının tematik haritası ve akademik özeti. Tezleri stratejik rolüne göre gruplayarak tematik özetle. Her tezden bahsederken mutlaka APA formatında atıf ver: (Yazar, Yıl). Maks 1200 karakter.",
        },
        academicGap: {
          type: "string",
          maxLength: 800,
          description:
            "Literatürdeki Boşluk: İncelediğin tezlerin neleri göz ardı ettiği veya yetersiz kaldığı alanların analizi. Mutlaka APA atıflarıyla açıkla. Maks 800 karakter.",
        },
        originalContribution: {
          type: "string",
          maxLength: 600,
          description:
            "Çalışmanın Özgün Katkısı: Kullanıcının tez matrisinin bu boşluğu nasıl doldurduğu ve literatüre getirdiği akademik yenilik. Maks 600 karakter.",
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
