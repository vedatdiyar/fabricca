import { z } from "zod";

/**
 * Zod validation schema for the universal thesis positioning matrix.
 * Enforces minimum length constraints across the 3 core academic dimensions.
 */
export const positioningMatrixSchema = z.object({
  subjectProblem: z
    .string()
    .trim()
    .min(3, "Araştırma problemi en az 3 karakter olmalıdır."),
  theoreticalFramework: z
    .string()
    .trim()
    .min(3, "Kuramsal veya kavramsal çerçeve en az 3 karakter olmalıdır."),
  methodology: z
    .string()
    .trim()
    .min(3, "Yöntem ve ampirik bağlam en az 3 karakter olmalıdır."),
});

/** Input payload type inferred from the positioning matrix Zod schema. */
export type PositioningMatrixInput = z.infer<typeof positioningMatrixSchema>;

/** Strategic literature roles for positioning recommended theses. */
export const strategicRoleEnum = z.enum([
  "SPECIFIC_FOCUS",
  "FOUNDATIONAL_WORK",
  "METHODOLOGICAL_BENCHMARK",
  "ALTERNATIVE_PERSPECTIVE",
]);

export type StrategicRole = z.infer<typeof strategicRoleEnum>;

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
  strategicRole?: StrategicRole;
  literaturePosition?: string;
  contributionArea: string;
  relevanceReason: string;
  doi?: string;
  thesisType?: string;
  abstract?: string;
  tezaraUrl?: string;
}

/** Zod validation schema for the 3 structured gap analysis sections. */
export const gapAnalysisStructuredSchema = z.object({
  literatureMapping: z
    .string()
    .describe(
      "Mevcut Literatürün Haritalandırılması bölümünün akademik analizi (Mevcut çalışmalar nerede yoğunlaşıyor?)",
    ),
  academicGap: z
    .string()
    .describe(
      "Literatürdeki Boşluk bölümünün akademik analizi (Mevcut çalışmalar neleri açıkta bıraktı?)",
    ),
  originalContribution: z
    .string()
    .describe(
      "Çalışmanın Özgün Katkısı bölümünün akademik analizi (Araştırmacının tezi bu boşluğu nasıl dolduracak?)",
    ),
});

/** Structured gap analysis type inferred from Zod schema. */
export type GapAnalysisStructured = z.infer<typeof gapAnalysisStructuredSchema>;
