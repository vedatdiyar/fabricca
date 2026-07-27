import { z } from "zod";
import type { JsonSchema, JsonSchemaProperty } from "@/lib/services/gemini";

// ── Phase 1: Structure-only (NO semanticQuery) ──────────────────────────

const structureSubBoxSchema = z.object({
  title: z
    .string()
    .describe("Alt kutu başlığı. Kesinlikle akademik Türkçe olmalıdır."),
  description: z
    .string()
    .describe("Alt kutu açıklaması. Kesinlikle akademik Türkçe olmalıdır."),
  concepts: z
    .array(z.string())
    .describe(
      "Sub-box seviyesinde 1 veya 2 kelimelik nokta atışı akademik Türkçe terimler. Her sub-box için ideal kavram sayısına sen karar ver (örn: 'Kurumsal Adaptasyon', 'Teknoloji Kabulü', 'Performans Etkisi').",
    ),
});

const structureQuadrantSchema = z.object({
  title: z
    .string()
    .describe("Kadran başlığı. Kesinlikle akademik Türkçe olmalıdır."),
  description: z
    .string()
    .describe("Kadran açıklaması. Kesinlikle akademik Türkçe olmalıdır."),
  subBoxes: z
    .array(structureSubBoxSchema)
    .min(1)
    .describe(
      "Bütünleşik konular için 1 alt kutu (N=1), heterojen konular için N>=2 alt kutu.",
    ),
});

export const boxStructureSchema = z.object({
  analysis: z.object({
    detected_heterogeneity: z
      .boolean()
      .describe(
        "Kadranlar bazında kuramsal/ampirik/yöntemsel çok kulvarlılık tespiti.",
      ),
    allocation_rationale: z
      .string()
      .describe(
        "3 kadranın her biri için alt kutu alokasyon kararlarının (N=1 veya N>=2) ve kadran yapılandırmasının Türkçe açıklaması.",
      ),
  }),
  subjectProblem: structureQuadrantSchema,
  theoreticalFramework: structureQuadrantSchema,
  primaryMaterial: structureQuadrantSchema,
  methodology: structureQuadrantSchema,
});

export type RawBoxStructureResponse = z.infer<typeof boxStructureSchema>;

function buildStructureQuadrantJsonSchema(): JsonSchemaProperty {
  return {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Kadran başlığı (Kesinlikle akademik Türkçe olmalıdır)",
      },
      description: {
        type: "string",
        description: "Kadran açıklaması (Kesinlikle akademik Türkçe olmalıdır)",
      },
      subBoxes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description:
                "Alt kutu başlığı (Kesinlikle akademik Türkçe olmalıdır)",
            },
            description: {
              type: "string",
              description:
                "Alt kutu açıklaması (Kesinlikle akademik Türkçe olmalıdır)",
            },
            concepts: {
              type: "array",
              items: { type: "string" },
              description:
                "1-2 kelimelik nokta atışı akademik Türkçe terimler. Her sub-box için ideal kavram sayısına sen karar ver.",
            },
          },
          required: ["title", "description", "concepts"],
        },
      },
    },
    required: ["title", "description", "subBoxes"],
  };
}

export const boxStructureJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    analysis: {
      type: "object",
      properties: {
        detected_heterogeneity: {
          type: "boolean",
          description: "Kuramsal/ampirik/yöntemsel çok kulvarlılık tespiti",
        },
        allocation_rationale: {
          type: "string",
          description: "Alt kutu alokasyon karar gerekçesi",
        },
      },
      required: ["detected_heterogeneity", "allocation_rationale"],
      description: "Analiz ve alokasyon planlaması",
    },
    subjectProblem: buildStructureQuadrantJsonSchema(),
    theoreticalFramework: buildStructureQuadrantJsonSchema(),
    primaryMaterial: buildStructureQuadrantJsonSchema(),
    methodology: buildStructureQuadrantJsonSchema(),
  },
  required: [
    "analysis",
    "subjectProblem",
    "theoreticalFramework",
    "primaryMaterial",
    "methodology",
  ],
};

// ── Phase 2: Bulk semanticQuery generation ──────────────────────────────

export const semanticQueryEntrySchema = z.object({
  subBoxTitle: z
    .string()
    .describe("Eşleştirme için alt kutu başlığı (Phase 1'deki ile aynı)."),
  semanticQuery: z
    .string()
    .min(50)
    .max(2000)
    .describe(
      "OpenAlex GTE Large EN aramasına özel, 200-600 karakter İngilizce doğal akademik paragraf. Doğal dilde, tırnak/parantez/şablon içermeyen, akıcı bir araştırma odağı metni.",
    ),
});

export const bulkSemanticQuerySchema = z.object({
  semanticQueries: z
    .array(semanticQueryEntrySchema)
    .min(1)
    .describe("Her sub-box için bir semanticQuery girişi."),
});

export type BulkSemanticQueryResponse = z.infer<typeof bulkSemanticQuerySchema>;

export const bulkSemanticQueryJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    semanticQueries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          subBoxTitle: {
            type: "string",
            description: "Eşleştirme için alt kutu başlığı",
          },
          semanticQuery: {
            type: "string",
            description:
              "OpenAlex GTE Large EN aramasına özel, 200-600 karakter İngilizce doğal akademik paragraf",
          },
        },
        required: ["subBoxTitle", "semanticQuery"],
      },
      minItems: 1,
    },
  },
  required: ["semanticQueries"],
};
