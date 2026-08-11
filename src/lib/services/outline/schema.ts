import { z } from "zod";
import type { JsonSchema, JsonSchemaProperty } from "@/lib/services/gemini";

/**
 * Recursive Zod schema for a single outline section (can contain subSections).
 */
const outlineSectionSchema: z.ZodType<{
  title: string;
  description: string;
  sortOrder: number;
  subSections: Array<{
    title: string;
    description: string;
    sortOrder: number;
  }>;
}> = z.lazy(() =>
  z.object({
    title: z
      .string()
      .describe("Bölüm başlığı. Kesinlikle akademik Türkçe olmalıdır."),
    description: z
      .string()
      .describe(
        "Bölüm açıklaması. Kısa ve öz bir akademik Türkçe açıklama olmalıdır.",
      ),
    sortOrder: z
      .number()
      .int()
      .describe("Bölümün gösterim sırası (1'den başlar)."),
    subSections: z
      .array(
        z.object({
          title: z
            .string()
            .describe("Alt bölüm başlığı. Akademik Türkçe olmalıdır."),
          description: z
            .string()
            .describe("Alt bölüm açıklaması."),
          sortOrder: z
            .number()
            .int()
            .describe("Alt bölümün gösterim sırası."),
        }),
      )
      .describe(
        "Bölümün alt bölümleri. Kavramsal olarak homojen ise boş dizi, heterojen ise en az 2 alt bölüm.",
      ),
  }),
);

/**
 * Zod schema for the full Gemini outline generation response.
 */
export const outlineGenerationSchema = z.object({
  academicField: z
    .string()
    .describe(
      "Tez çalışmasının bilim dalı (örn: İşletme, Bilgisayar Mühendisliği, Eğitim Bilimleri). Matris içeriğinden otomatik tespit edilmelidir.",
    ),
  sections: z
    .array(outlineSectionSchema)
    .min(1)
    .describe(
      "Tezin ana bölüm başlıkları. En az 3, en fazla 8 ana bölüm olmalıdır.",
    ),
});

export type OutlineGenerationResponse = z.infer<
  typeof outlineGenerationSchema
>;

/**
 * Builds the JSON schema property for a single outline section (recursive).
 */
function buildSectionJsonSchemaProperty(): JsonSchemaProperty {
  return {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Bölüm başlığı (Kesinlikle akademik Türkçe olmalıdır)",
      },
      description: {
        type: "string",
        description: "Bölüm açıklaması (Kısa ve öz akademik Türkçe)",
      },
      sortOrder: {
        type: "number",
        description: "Bölümün gösterim sırası (1'den başlar)",
      },
      subSections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Alt bölüm başlığı (Akademik Türkçe)",
            },
            description: {
              type: "string",
              description: "Alt bölüm açıklaması",
            },
            sortOrder: {
              type: "number",
              description: "Alt bölümün gösterim sırası",
            },
          },
          required: ["title", "description", "sortOrder"],
          additionalProperties: false,
        },
        description:
          "Alt bölümler. Homojen ise boş, heterojen ise en az 2 eleman.",
      },
    },
    required: ["title", "description", "sortOrder", "subSections"],
  };
}

/**
 * Raw JSON Schema for Gemini's responseJsonSchema constraint.
 */
export const outlineGenerationJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    academicField: {
      type: "string",
      description:
        "Tezin bilim dalı (matris içeriğinden otomatik tespit, ör: İşletme, Bilgisayar Mühendisliği)",
    },
    sections: {
      type: "array",
      items: buildSectionJsonSchemaProperty(),
      minItems: 1,
      description:
        "Tezin ana bölüm başlıkları. En az 3, en fazla 8 ana bölüm.",
    },
  },
  required: ["academicField", "sections"],
};
