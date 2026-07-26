import { z } from "zod";
import type { JsonSchema, JsonSchemaProperty } from "../../services/gemini";

/**
 * Sub-box schema with inline semanticQuery.
 * Every sub-box carries its own OpenAlex vector search paragraph.
 */
const subBoxSchema = z.object({
  title: z
    .string()
    .describe("Alt kutu başlığı. Kesinlikle akademik Türkçe olmalıdır."),
  description: z
    .string()
    .describe("Alt kutu açıklaması. Kesinlikle akademik Türkçe olmalıdır."),
  concepts: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe(
      "Sub-box seviyesinde KESİNLİKLE EN AZ 3, EN FAZLA 5 ELEMANDAN oluşan 1 veya 2 kelimelik nokta atışı akademik Türkçe terimler (örn: 'Kurumsal Adaptasyon', 'Teknoloji Kabulü', 'Performans Etkisi').",
    ),
  semanticQuery: z
    .string()
    .describe(
      "PRIMARY_MATERIAL kadranı için boş string (''). Diğer kadranlar (SUBJECT_PROBLEM, THEORETICAL_FRAMEWORK, ANALYSIS_ACTORS, METHODOLOGY) için OpenAlex GTE Large EN vektör aramasına özel, 300-1000 karakter, kadran izolasyon kurallarına uyan İngilizce akademik paragraf.",
    ),
});

const quadrantSchema = z.object({
  title: z
    .string()
    .describe("Kadran başlığı. Kesinlikle akademik Türkçe olmalıdır."),
  description: z
    .string()
    .describe("Kadran açıklaması. Kesinlikle akademik Türkçe olmalıdır."),
  subBoxes: z
    .array(subBoxSchema)
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
        "4 kadranın her biri için alt kutu alokasyon kararlarının (N=1 veya N>=2) ve kadran yapılandırmasının Türkçe açıklaması.",
      ),
  }),
  subjectProblem: quadrantSchema,
  theoreticalFramework: quadrantSchema,
  analysisActors: quadrantSchema,
  primaryMaterial: quadrantSchema,
  methodology: quadrantSchema,
});

export type RawBoxStructureResponse = z.infer<typeof boxStructureSchema>;

function buildQuadrantJsonSchema(
  withSemanticQuery: boolean,
): JsonSchemaProperty {
  const subBoxProperties: Record<string, JsonSchemaProperty> = {
    title: {
      type: "string",
      description: "Alt kutu başlığı (Kesinlikle akademik Türkçe olmalıdır)",
    },
    description: {
      type: "string",
      description: "Alt kutu açıklaması (Kesinlikle akademik Türkçe olmalıdır)",
    },
    concepts: {
      type: "array",
      items: { type: "string" },
      description:
        "En az 3, en fazla 5 adet 1-2 kelimelik nokta atışı akademik Türkçe terim",
      minItems: 3,
      maxItems: 5,
    },
  };

  const subBoxRequired = ["title", "description", "concepts"];

  if (withSemanticQuery) {
    subBoxProperties.semanticQuery = {
      type: "string",
      description:
        "OpenAlex GTE Large EN vektör aramasına özel, 300-1000 karakter, kadran izolasyon kurallarına uyan İngilizce akademik paragraf. Bu kadran (SUBJECT_PROBLEM/THEORETICAL_FRAMEWORK/ANALYSIS_ACTORS/METHODOLOGY) için zorunludur.",
    };
    subBoxRequired.push("semanticQuery");
  }

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
          properties: subBoxProperties,
          required: subBoxRequired,
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
    subjectProblem: buildQuadrantJsonSchema(true),
    theoreticalFramework: buildQuadrantJsonSchema(true),
    analysisActors: buildQuadrantJsonSchema(true),
    primaryMaterial: buildQuadrantJsonSchema(false),
    methodology: buildQuadrantJsonSchema(true),
  },
  required: [
    "analysis",
    "subjectProblem",
    "theoreticalFramework",
    "analysisActors",
    "primaryMaterial",
    "methodology",
  ],
};
