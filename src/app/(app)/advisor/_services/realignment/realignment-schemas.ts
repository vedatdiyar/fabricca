import { z } from "zod";
import type { JsonSchema } from "@/core/services/ai";

/**
 * Zod schema for individual new/updated sub-box proposals generated during matrix realignment.
 */
export const realignedSubBoxSchema = z.object({
  parentBoxType: z
    .enum([
      "SUBJECT_PROBLEM",
      "THEORETICAL_FRAMEWORK",
      "PRIMARY_MATERIAL",
      "METHODOLOGY",
      "RELATED_THESES",
    ])
    .describe("The pillar quadrant this sub-box belongs to"),
  title: z
    .string()
    .min(3)
    .describe("Turkish title for the new research sub-box"),
  description: z
    .string()
    .min(10)
    .describe(
      "Detailed Turkish description of this sub-box in the context of the updated thesis matrix",
    ),
  concepts: z
    .array(z.string())
    .min(1)
    .describe(
      "List of core theoretical/methodological concepts in Turkish or English",
    ),
  semanticQuery: z
    .string()
    .min(5)
    .max(200)
    .describe(
      "Concise, high-impact English academic search query for OpenAlex (max 15 words). MUST NOT contain Boolean operators (AND, OR, NOT) or punctuation.",
    ),
});

export type RealignedSubBox = z.infer<typeof realignedSubBoxSchema>;

/**
 * Master Zod schema for full matrix realignment impact analysis.
 */
export const matrixRealignmentSchema = z.object({
  analysisSummary: z
    .string()
    .describe(
      "Academic evaluation in Turkish explaining how the matrix change impacts the thesis architecture",
    ),
  affectedBoxType: z
    .enum([
      "SUBJECT_PROBLEM",
      "THEORETICAL_FRAMEWORK",
      "PRIMARY_MATERIAL",
      "METHODOLOGY",
      "RELATED_THESES",
    ])
    .describe("The primary quadrant directly affected by this matrix update"),
  updatedPillarTitle: z
    .string()
    .optional()
    .describe(
      "Updated Turkish title for the main root pillar of the affected quadrant (e.g. 'Bourdieu Alan ve Habitus Kuramı')",
    ),
  obsoleteSubBoxIds: z
    .array(z.number())
    .default([])
    .describe(
      "IDs of existing sub-boxes belonging to the old framework/method that are now obsolete and must be deleted",
    ),
  newSubBoxes: z
    .array(realignedSubBoxSchema)
    .min(1)
    .max(3)
    .describe(
      "1 to 3 targeted, high-precision new sub-boxes directly matching the new matrix focus",
    ),
  outlineSuggestions: z
    .array(z.string())
    .default([])
    .describe("Suggestions for chapter/section adjustments in Turkish"),
});

export type MatrixRealignmentOutput = z.infer<typeof matrixRealignmentSchema>;

/**
 * Gemini JSON schema for Matrix Realignment.
 */
export const matrixRealignmentJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    analysisSummary: {
      type: "string",
      description:
        "Academic evaluation in Turkish explaining the impact of the matrix change",
    },
    affectedBoxType: {
      type: "string",
      enum: [
        "SUBJECT_PROBLEM",
        "THEORETICAL_FRAMEWORK",
        "PRIMARY_MATERIAL",
        "METHODOLOGY",
        "RELATED_THESES",
      ],
      description:
        "The primary quadrant directly affected by this matrix update",
    },
    updatedPillarTitle: {
      type: "string",
      description:
        "Updated Turkish title for the main root pillar of the affected quadrant",
    },
    obsoleteSubBoxIds: {
      type: "array",
      items: { type: "integer" },
      description:
        "IDs of existing sub-boxes that are no longer aligned with the new matrix and must be deleted",
    },
    newSubBoxes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          parentBoxType: {
            type: "string",
            enum: [
              "SUBJECT_PROBLEM",
              "THEORETICAL_FRAMEWORK",
              "PRIMARY_MATERIAL",
              "METHODOLOGY",
              "RELATED_THESES",
            ],
          },
          title: { type: "string" },
          description: { type: "string" },
          concepts: {
            type: "array",
            items: { type: "string" },
          },
          semanticQuery: {
            type: "string",
            description:
              "Concise English academic search query for OpenAlex (max 15 words)",
          },
        },
        required: [
          "parentBoxType",
          "title",
          "description",
          "concepts",
          "semanticQuery",
        ],
      },
    },
    outlineSuggestions: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "analysisSummary",
    "affectedBoxType",
    "obsoleteSubBoxIds",
    "newSubBoxes",
  ],
};
