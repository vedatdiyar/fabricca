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

/** Structure for individual recommended thesis/literature entries in gap analysis reports. */
export interface RecommendedThesisItem {
  id?: string;
  externalThesisId?: string;
  title: string;
  author: string;
  year: number;
  university: string;
  publicationType?: "Tez" | "Makale" | "Kitap" | "Kitap Bölümü" | "Rapor";
  sourceChannel?: "yok" | "openalex" | "semantic_scholar" | "exa";
  strategicRole?: StrategicRole;
  literaturePosition?: string;
  contributionArea: string;
  relevanceReason: string;
  doi?: string;
  thesisType?: string;
  abstract?: string;
  url?: string;
  yokUrl?: string;
}

export interface PivotOption {
  id: "field_pivot" | "theory_pivot" | "method_pivot";
  dimension: "SAHA_ORNEKLEM" | "KURAMSAL_CERCEVE" | "YONTEMSEL_DESEN";
  title: string;
  description: string;
  suggestedFocus: string;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  category: "scope" | "focus" | "methodology" | "theoretical";
  contextNote: string;
}

export interface OverlappingWork {
  title: string;
  author?: string;
  year?: number;
  sourceType: string;
  reason: string;
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
  overlappingWorks: z
    .array(
      z.object({
        title: z.string(),
        author: z.string().optional(),
        year: z.number().optional(),
        sourceType: z.string(),
        reason: z.string(),
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

