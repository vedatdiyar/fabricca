import { z } from "zod";

/**
 * Zod validation schema for universal thesis positioning matrix.
 * Enforces mandatory minimum length constraints across 5 core academic fields.
 */
export const positioningMatrixSchema = z.object({
  subjectAndProblem: z
    .string()
    .trim()
    .min(
      200,
      "Çalışmanın odağı ve problemi akademik derinlik için en az 200 karakter olmalıdır.",
    ),
  theoreticalFramework: z
    .string()
    .trim()
    .min(
      200,
      "Teorik veya kavramsal çerçeve akademik netlik için en az 200 karakter olmalıdır.",
    ),
  unitOfAnalysis: z
    .string()
    .trim()
    .min(
      150,
      "Analiz birimi, aktörler veya odak nesne en az 150 karakter olmalıdır.",
    ),
  methodology: z
    .string()
    .trim()
    .min(150, "Metodoloji ve yöntem en az 150 karakter olmalıdır."),
  scopeAndContext: z
    .string()
    .trim()
    .min(150, "Kapsam ve sınırlar en az 150 karakter olmalıdır."),
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
