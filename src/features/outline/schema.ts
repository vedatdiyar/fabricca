import { z } from "zod";
import type { JsonSchema, JsonSchemaProperty } from "@/services/ai";

/**
 * Recursive Zod schema for a single outline section (can contain subSections).
 */
const outlineSectionSchema: z.ZodType<{
  title: string;
  description: string;
  sortOrder: number;
  recommendedBoxTypes?: string[];
  subSections: Array<{
    title: string;
    description: string;
    sortOrder: number;
    recommendedBoxTypes?: string[];
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
    recommendedBoxTypes: z
      .array(z.string())
      .optional()
      .describe(
        "Bu bölümün besleneceği ilgili Konu Kutusu türleri (ör. ['THEORETICAL_FRAMEWORK', 'SUBJECT_PROBLEM']).",
      ),
    subSections: z
      .array(
        z.object({
          title: z
            .string()
            .describe("Alt bölüm başlığı. Akademik Türkçe olmalıdır."),
          description: z.string().describe("Alt bölüm açıklaması."),
          sortOrder: z.number().int().describe("Alt bölümün gösterim sırası."),
          recommendedBoxTypes: z
            .array(z.string())
            .optional()
            .describe(
              "Bu alt bölümün besleneceği ilgili Konu Kutusu türleri (ör. ['METHODOLOGY']).",
            ),
        }),
      )
      .describe(
        "Gövde bölümleri için en az 2 alt bölüm. Giriş ve Sonuç bölümleri için boş dizi ([]).",
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
      "Tez çalışmasının bilim dalı (örn: İşletme, Bilgisayar Mühendisliği, Hukuk, Siyaset Bilimi). Matris içeriğinden otomatik tespit edilmelidir.",
    ),
  sections: z
    .array(outlineSectionSchema)
    .min(4)
    .max(5)
    .describe(
      "Tezin ana bölüm başlıkları (Giriş [alt başlıksız], 2-3 Ana Gövde Bölümü [alt başlıklı], Sonuç ve Değerlendirme [alt başlıksız] olmak üzere toplam 4 veya 5 ana bölüm).",
    ),
});

export type OutlineGenerationResponse = z.infer<typeof outlineGenerationSchema>;

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
      recommendedBoxTypes: {
        type: "array",
        items: { type: "string" },
        description:
          "İlgili konu kutusu türleri: 'SUBJECT_PROBLEM', 'THEORETICAL_FRAMEWORK', 'PRIMARY_MATERIAL', 'METHODOLOGY'",
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
            recommendedBoxTypes: {
              type: "array",
              items: { type: "string" },
              description: "İlgili alt konu kutusu türleri",
            },
          },
          required: ["title", "description", "sortOrder"],
          additionalProperties: false,
        },
        description:
          "Alt bölümler. Gövde bölümleri altında en az 2 alt bölüm yer alır. Giriş ve Sonuç bölümleri için boş dizi ([]).",
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
        "Tezin bilim dalı (matris içeriğinden otomatik tespit, ör: İşletme, Bilgisayar Mühendisliği, Hukuk, Siyaset Bilimi)",
    },
    sections: {
      type: "array",
      items: buildSectionJsonSchemaProperty(),
      minItems: 4,
      maxItems: 5,
      description:
        "Tezin ana bölüm başlıkları (Bölüm 1 Giriş [alt başlıksız], Bölüm 2 ve 3 [veya 4] Ana Gövde Bölümleri [en az 2 alt bölüm], Son Bölüm Sonuç ve Değerlendirme [alt başlıksız] olmak üzere toplam tam olarak 4 veya 5 ana bölüm).",
    },
  },
  required: ["academicField", "sections"],
};
