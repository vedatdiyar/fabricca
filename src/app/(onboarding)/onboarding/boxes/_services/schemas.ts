import { z } from "zod";
import type { JsonSchema, JsonSchemaProperty } from "@/core/services/ai";

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
  }),
  subjectProblem: structureQuadrantSchema,
  theoreticalFramework: structureQuadrantSchema,
  methodology: structureQuadrantSchema,
  primaryMaterial: structureQuadrantSchema,
});

export type RawBoxStructureResponse = z.infer<typeof boxStructureSchema>;

/**
 * Builds the JSON schema for a single box structure quadrant.
 *
 * @returns The quadrant JSON schema property.
 */
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
      },
      required: ["detected_heterogeneity"],
      description: "Analiz ve heterojenite tespiti",
    },
    subjectProblem: buildStructureQuadrantJsonSchema(),
    theoreticalFramework: buildStructureQuadrantJsonSchema(),
    methodology: buildStructureQuadrantJsonSchema(),
    primaryMaterial: buildStructureQuadrantJsonSchema(),
  },
  required: [
    "analysis",
    "subjectProblem",
    "theoreticalFramework",
    "methodology",
    "primaryMaterial",
  ],
};

export const semanticQueryEntrySchema = z.object({
  subBoxTitle: z
    .string()
    .describe("Eşleştirme için alt kutu başlığı (Phase 1'deki ile aynı)."),
  openAlexSemanticQuery: z
    .string()
    .min(500)
    .max(1500)
    .refine((v) => !/[çÇğĞıIöÖşŞüÜ]/.test(v), {
      message:
        "openAlexSemanticQuery must be English and contain no Turkish characters.",
    })
    .describe(
      "Dense English academic research paragraph for OpenAlex GTE Large EN search, 5+-1 sentences and 170-210 words (~1000-1250 characters), never exceeding 1500 characters. English only — never Turkish.",
    ),
  openAlexLexicalQueries: z
    .array(z.string().min(3))
    .min(0)
    .max(3)
    .default([])
    .describe(
      "OpenAlex 100 req/s metin araması için tam 3 adet hedeflenmiş lexical sorgu (Anchor + Focus formülü, çift tırnaklı öbekler).",
    ),
});

export const bulkSemanticQuerySchema = z.object({
  semanticQueries: z
    .array(semanticQueryEntrySchema)
    .min(1)
    .describe("Her sub-box için bir openAlexSemanticQuery girişi."),
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
          openAlexSemanticQuery: {
            type: "string",
            description:
              "Dense English academic research paragraph for OpenAlex GTE Large EN search, 5+-1 sentences and 170-210 words (~1000-1250 characters), never exceeding 1500 characters. English only, never Turkish",
          },
          openAlexLexicalQueries: {
            type: "array",
            items: { type: "string" },
            description:
              "OpenAlex 100 req/s metin araması için tam 3 adet hedeflenmiş lexical sorgu (Anchor + Focus formülü, çift tırnaklı öbekler)",
          },
        },
        required: ["subBoxTitle", "openAlexSemanticQuery", "openAlexLexicalQueries"],
      },
      minItems: 1,
    },
  },
  required: ["semanticQueries"],
};
