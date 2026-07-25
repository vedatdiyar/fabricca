import { z } from "zod";
import type { JsonSchema, JsonSchemaProperty } from "../../services/gemini";

// ── Phase 1: Box Structure Schemas ──────────────────────────────────────────

const subBoxStructureSchema = z.object({
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
});

const quadrantStructureSchema = z.object({
  title: z
    .string()
    .describe("Kadran başlığı. Kesinlikle akademik Türkçe olmalıdır."),
  description: z
    .string()
    .describe("Kadran açıklaması. Kesinlikle akademik Türkçe olmalıdır."),
  subBoxes: z
    .array(subBoxStructureSchema)
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
        "5 kadranın her biri için alt kutu alokasyon kararlarının (N=1 veya N>=2) ve kadran yapılandırmasının Türkçe açıklaması.",
      ),
  }),
  conceptual: quadrantStructureSchema,
  problematization: quadrantStructureSchema,
  context: quadrantStructureSchema,
  dataProtocol: quadrantStructureSchema,
  primaryMaterial: quadrantStructureSchema,
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
                "En az 3, en fazla 5 adet 1-2 kelimelik nokta atışı akademik Türkçe terim",
              minItems: 3,
              maxItems: 5,
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
    conceptual: buildStructureQuadrantJsonSchema(),
    problematization: buildStructureQuadrantJsonSchema(),
    context: buildStructureQuadrantJsonSchema(),
    dataProtocol: buildStructureQuadrantJsonSchema(),
    primaryMaterial: buildStructureQuadrantJsonSchema(),
  },
  required: [
    "analysis",
    "conceptual",
    "problematization",
    "context",
    "dataProtocol",
    "primaryMaterial",
  ],
};

// ── Phase 2: Semantic Queries Schemas ────────────────────────────────────────

const subBoxSemanticQuerySchema = z.object({
  title: z.string().describe("Alt kutu başlığı"),
  semanticQuery: z
    .string()
    .describe(
      "PRIMARY_MATERIAL kadranı için boş string (''). Diğer kadranlar için OpenAlex AI vektör arama motoru (GTE Large EN) için özel olarak yazılmış 2-4 cümlelik (300-1000 karakter) spesifik İngilizce akademik özet/paragraf.",
    ),
});

const quadrantSemanticQueriesSchema = z.object({
  subBoxes: z.array(subBoxSemanticQuerySchema),
});

export const semanticQueriesSchema = z.object({
  conceptual: quadrantSemanticQueriesSchema,
  problematization: quadrantSemanticQueriesSchema,
  context: quadrantSemanticQueriesSchema,
  dataProtocol: quadrantSemanticQueriesSchema,
  primaryMaterial: quadrantSemanticQueriesSchema,
});

export type RawSemanticQueriesResponse = z.infer<typeof semanticQueriesSchema>;

function buildSemanticQueriesQuadrantJsonSchema(): JsonSchemaProperty {
  return {
    type: "object",
    properties: {
      subBoxes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            semanticQuery: {
              type: "string",
              description:
                "OpenAlex AI vektör arama motoru (GTE Large EN) için 2-4 cümlelik (300-1000 karakter) zengin ve özne-çapalı İngilizce akademik paragraf metni (PRIMARY_MATERIAL kadranı için boş string '')",
            },
          },
          required: ["title", "semanticQuery"],
        },
      },
    },
    required: ["subBoxes"],
  };
}

export const semanticQueriesJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    conceptual: buildSemanticQueriesQuadrantJsonSchema(),
    problematization: buildSemanticQueriesQuadrantJsonSchema(),
    context: buildSemanticQueriesQuadrantJsonSchema(),
    dataProtocol: buildSemanticQueriesQuadrantJsonSchema(),
    primaryMaterial: buildSemanticQueriesQuadrantJsonSchema(),
  },
  required: [
    "conceptual",
    "problematization",
    "context",
    "dataProtocol",
    "primaryMaterial",
  ],
};
