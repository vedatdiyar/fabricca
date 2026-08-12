import { z } from "zod";

/**
 * Zod validation schema for the universal thesis positioning matrix that enforces
 * mandatory minimum length constraints across 3 core academic fields, excludes
 * ANALYSIS_ACTORS (now part of subjectProblem), and includes only positioning fields.
 */
export const positioningMatrixSchema = z.object({
  subjectProblem: z
    .string()
    .trim()
    .min(3, "Research problem must be at least 3 characters."),
  theoreticalFramework: z
    .string()
    .trim()
    .min(
      3,
      "Theoretical or conceptual framework must be at least 3 characters.",
    ),
  methodology: z
    .string()
    .trim()
    .min(3, "Methodology and method must be at least 3 characters."),
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
  thesisType?: string;
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
