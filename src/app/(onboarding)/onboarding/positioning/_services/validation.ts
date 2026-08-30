import { z } from "zod";
import type {
  RecommendedThesisItem as CoreRecommendedThesisItem,
  GapAnalysisStructured as CoreGapAnalysisStructured,
  StrategicRole as CoreStrategicRole,
  PositioningGlobalStatus as CorePositioningGlobalStatus,
  PivotOption as CorePivotOption,
  ClarificationQuestion as CoreClarificationQuestion,
  OverlappingWork as CoreOverlappingWork,
} from "@/core/types/jsonb";

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
  primaryMaterial: z.string().trim().optional(),
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
// Re-export canonical core type for backwards compatibility
export type { CoreStrategicRole as StrategicRoleCore };

/** Enum type representing the global positioning / literature gap status. */
export type PositioningGlobalStatus = CorePositioningGlobalStatus;

/** Structure for individual recommended thesis/literature entries in gap analysis reports. */
export type RecommendedThesisItem = CoreRecommendedThesisItem;

export type PivotOption = CorePivotOption;

export type ClarificationQuestion = CoreClarificationQuestion;

export type OverlappingWork = CoreOverlappingWork;

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
  overlappingWorks: z
    .array(
      z.object({
        title: z.string(),
        author: z.string().optional(),
        year: z.number().optional(),
        sourceType: z.string(),
        reason: z.string(),
        problemOverlap: z.string().optional(),
        theoryOverlap: z.string().optional(),
        methodologyOverlap: z.string().optional(),
      }),
    )
    .optional(),
  pivotOptions: z
    .array(
      z.object({
        id: z.enum(["field_pivot", "theory_pivot", "method_pivot"]),
        dimension: z.enum([
          "SAHA_ORNEKLEM",
          "KURAMSAL_CERCEVE",
          "YONTEMSEL_DESEN",
        ]),
        title: z.string(),
        description: z.string(),
        suggestedFocus: z.string(),
      }),
    )
    .optional(),
  clarificationQuestions: z
    .array(
      z.object({
        id: z.string(),
        question: z.string(),
        category: z.enum(["scope", "focus", "methodology", "theoretical"]),
        contextNote: z.string(),
      }),
    )
    .optional(),
});

/** Structured gap analysis type inferred from Zod schema. */
export type GapAnalysisStructured = z.infer<typeof gapAnalysisStructuredSchema>;
// Ensure zod-inferred type stays assignable to canonical core type
export type _GapAnalysisCoreCheck = GapAnalysisStructured extends CoreGapAnalysisStructured
  ? true
  : never;
