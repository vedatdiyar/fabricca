import { z } from "zod";
import type { JsonSchema, JsonSchemaProperty } from "../../services/gemini";

const subBoxSchema = z.object({
  title: z
    .string()
    .describe("Alt kutu başlığı. Kesinlikle akademik Türkçe olmalıdır."),
  description: z
    .string()
    .describe("Alt kutu açıklaması. Kesinlikle akademik Türkçe olmalıdır."),
  semanticQuery: z
    .string()
    .describe(
      "PRIMARY_MATERIAL kadranı için boş string ('') olmalıdır. Diğer kadranlar için OpenAlex AI vektör arama motoru (GTE Large EN) için özel olarak yazılmış, alt kutunun ampirik odağını, kuramsal bağlamını ve aktörlerini eksiksiz açıklayan 2-4 cümlelik (300-800 karakter) paragraf biçiminde resmî İngilizce akademik özet metni olmalıdır.",
    ),
  foundationalQueries: z
    .array(
      z.object({
        author: z.string(),
        title: z.string(),
        publicationYear: z.number(),
      }),
    )
    .default([]),
});

const quadrantSchema = z.object({
  title: z
    .string()
    .describe("Kadran başlığı. Kesinlikle akademik Türkçe olmalıdır."),
  description: z
    .string()
    .describe("Kadran açıklaması. Kesinlikle akademik Türkçe olmalıdır."),
  concepts: z
    .array(z.string())
    .min(4)
    .max(5)
    .describe(
      "Concepts dizisi KESİNLİKLE EN AZ 4, EN FAZLA 5 ELEMANDAN (4 veya 5 adet) oluşmalıdır. Kesinlikle akademik Türkçe terimler olmalıdır.",
    ),
  subBoxes: z
    .array(subBoxSchema)
    .min(1)
    .describe(
      "Homojen hedefler için 1 alt kutu, heterojen hedefler için 2 veya daha fazla (N>=2) alt kutu.",
    ),
});

export const thesisBoxGenerationSchema = z.object({
  analysis: z.object({
    detected_heterogeneity: z
      .boolean()
      .describe(
        "Kuramsal veya ampirik hedeflerin çok kulvarlı/heterojen olup olmadığının tespiti.",
      ),
    allocation_rationale: z
      .string()
      .describe(
        "Alt kutu alokasyon kararlarının ve kadran yapılandırmasının Türkçe açıklaması.",
      ),
    epistemological_boundaries: z
      .object({
        conceptual_query_nature: z
          .string()
          .describe(
            "CONCEPTUAL kadranı sorgusunun saf teorik niteliği (ampirik vaka adı barındırmaz).",
          ),
        problematization_query_nature: z
          .string()
          .describe(
            "PROBLEMATIZATION kadranı sorgusunun ampirik aktör ve gerilim odağı.",
          ),
        context_query_nature: z
          .string()
          .describe(
            "CONTEXT kadranı sorgusunun tarihsel ve mekânsal konjonktür çapaları.",
          ),
        data_protocol_query_nature: z
          .string()
          .describe(
            "DATA_PROTOCOL kadranı sorgusunun saf metodolojik niteliği (ampirik vaka adı barındırmaz).",
          ),
      })
      .describe(
        "Her kadranın 'semanticQuery' metnini üretmeden önce anlamsal sınırlarının CoT disiplini ile izole edilmesi.",
      ),
  }),
  conceptual: quadrantSchema,
  problematization: quadrantSchema,
  context: quadrantSchema,
  dataProtocol: quadrantSchema,
  primaryMaterial: quadrantSchema,
});

export type RawNestedResponse = z.infer<typeof thesisBoxGenerationSchema>;

function buildQuadrantJsonSchema(): JsonSchemaProperty {
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
      concepts: {
        type: "array",
        items: { type: "string" },
        description: "En az 4, en fazla 5 adet akademik Türkçe kavram terimi",
        minItems: 4,
        maxItems: 5,
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
            semanticQuery: {
              type: "string",
              description:
                "OpenAlex AI vektör arama motoru (GTE Large EN) için 2-4 cümlelik (300-800 karakter) zengin İngilizce akademik özet/paragraf metni (PRIMARY_MATERIAL kadranı için boş string '')",
            },
            foundationalQueries: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  author: { type: "string" },
                  title: { type: "string" },
                  publicationYear: { type: "number" },
                },
                required: ["author", "title", "publicationYear"],
              },
              description:
                "Temel kurucu kaynak bilgileri (Veri yoksa boş dizi [] olarak bırakılmalıdır)",
            },
          },
          required: [
            "title",
            "description",
            "semanticQuery",
            "foundationalQueries",
          ],
        },
      },
    },
    required: ["title", "description", "concepts", "subBoxes"],
  };
}

export const thesisBoxGenerationJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    analysis: {
      type: "object",
      properties: {
        detected_heterogeneity: {
          type: "boolean",
          description: "Kuramsal/ampirik çok kulvarlılık tespiti",
        },
        allocation_rationale: {
          type: "string",
          description: "Alt kutu alokasyon karar gerekçesi",
        },
        epistemological_boundaries: {
          type: "object",
          properties: {
            conceptual_query_nature: {
              type: "string",
              description: "CONCEPTUAL sorgusunun saf teorik niteliği",
            },
            problematization_query_nature: {
              type: "string",
              description: "PROBLEMATIZATION sorgusunun ampirik gerilim odağı",
            },
            context_query_nature: {
              type: "string",
              description: "CONTEXT sorgusunun tarihsel ve mekânsal çapaları",
            },
            data_protocol_query_nature: {
              type: "string",
              description: "DATA_PROTOCOL sorgusunun saf metodolojik niteliği",
            },
          },
          required: [
            "conceptual_query_nature",
            "problematization_query_nature",
            "context_query_nature",
            "data_protocol_query_nature",
          ],
          description: "CoT kadran izole sınır analizi",
        },
      },
      required: [
        "detected_heterogeneity",
        "allocation_rationale",
        "epistemological_boundaries",
      ],
      description: "Chain of Thought analiz ve izole kadran planlaması",
    },
    conceptual: buildQuadrantJsonSchema(),
    problematization: buildQuadrantJsonSchema(),
    context: buildQuadrantJsonSchema(),
    dataProtocol: buildQuadrantJsonSchema(),
    primaryMaterial: buildQuadrantJsonSchema(),
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
