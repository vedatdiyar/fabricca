import { z } from "zod";

/**
 * Zod validation schema for universal thesis positioning matrix.
 * Enforces mandatory minimum length constraints across 5 core academic fields.
 * Only fields relevant to positioning are included.
 */
export const positioningMatrixSchema = z.object({
  subjectProblem: z
    .string()
    .trim()
    .min(3, "Araştırma problemi en az 3 karakter olmalıdır."),
  theoreticalFramework: z
    .string()
    .trim()
    .min(3, "Teorik veya kavramsal çerçeve en az 3 karakter olmalıdır."),
  analysisActors: z
    .string()
    .trim()
    .min(
      3,
      "Analiz birimi, aktörler veya odak nesne en az 3 karakter olmalıdır.",
    ),
  methodology: z
    .string()
    .trim()
    .min(3, "Metodoloji ve yöntem en az 3 karakter olmalıdır."),
});

/** Input payload type inferred from the positioning matrix Zod schema. */
export type PositioningMatrixInput = z.infer<typeof positioningMatrixSchema>;

/** Enum type representing the global positioning / literature gap status. */
export type PositioningGlobalStatus =
  "DIRECT_OVERLAP" | "NOVEL_GAP_IDENTIFIED" | "NO_RELATED_LITERATURE";

/** Structure for individual recommended thesis entries in gap analysis reports. */
export interface RecommendedThesisItem {
  id?: string;
  externalThesisId?: string;
  title: string;
  author: string;
  year: number;
  university: string;
  contributionArea: string;
  relevanceReason: string;
  doi?: string;
}

/** Zod validation schema for the 3 structured gap analysis sections. */
export const gapAnalysisStructuredSchema = z.object({
  literatureMapping: z
    .string()
    .describe(
      "Mevcut Literatürün Haritalandırılması bölümünün akademik analizi",
    ),
  academicGap: z
    .string()
    .describe("Literatürdeki Boşluk bölümünün akademik analizi"),
  originalContribution: z
    .string()
    .describe("Çalışmanın Özgün Katkısı bölümünün akademik analizi"),
});

/** Structured gap analysis type inferred from Zod schema. */
export type GapAnalysisStructured = z.infer<typeof gapAnalysisStructuredSchema>;
