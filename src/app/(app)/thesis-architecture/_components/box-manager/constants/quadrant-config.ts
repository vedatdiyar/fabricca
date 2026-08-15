import type { ComponentType } from "react";
import { Target, Compass, Microscope, BookOpen } from "lucide-react";
import type { Box } from "@/db/schema";
import type { ThesisBoxType } from "@/lib/box-constants";

/** A topic box enriched with its lightweight relation summary counts. */
export interface BoxWithRelations extends Box {
  sources?: { id: number }[];
  tasks?: { id: number }[];
}

/** Visual + descriptive configuration for a single research quadrant. */
export interface QuadrantConfig {
  type: ThesisBoxType;
  number: number;
  label: string;
  shortLabel: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  accentColor: string;
  badgeColor: string;
}

const FALLBACK_QUADRANT_CONFIG: QuadrantConfig = {
  type: "SUBJECT_PROBLEM",
  number: 1,
  label: "",
  shortLabel: "",
  description: "",
  icon: Target,
  accentColor: "bg-muted text-muted-foreground border-border",
  badgeColor: "bg-muted text-muted-foreground border-border",
};

/** The four canonical research quadrants with their icon/color configuration. */
export const QUADRANTS: Record<string, QuadrantConfig> = {
  SUBJECT_PROBLEM: {
    type: "SUBJECT_PROBLEM",
    number: 1,
    label: "Araştırma Problemi ve Odak",
    shortLabel: "Araştırma Odağı",
    description:
      "Tezin ana araştırma sorunsalını, aktörlerini ve inceleme kapsamını gruplandıran tematik havuz.",
    icon: Target,
    accentColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  THEORETICAL_FRAMEWORK: {
    type: "THEORETICAL_FRAMEWORK",
    number: 2,
    label: "Teorik ve Kavramsal Çerçeve",
    shortLabel: "Teorik Çerçeve",
    description:
      "Çalışmanın yaslandığı kuramsal merceği, analitik kavramları ve teorik modelleri içeren havuz.",
    icon: Compass,
    accentColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  METHODOLOGY: {
    type: "METHODOLOGY",
    number: 3,
    label: "Metodoloji ve Araştırma Yöntemi",
    shortLabel: "Metodoloji",
    description:
      "Nitel/söylemsel analiz yöntemlerini, kodlama şemalarını ve araştırma tasarımını içeren havuz.",
    icon: Microscope,
    accentColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  PRIMARY_MATERIAL: {
    type: "PRIMARY_MATERIAL",
    number: 4,
    label: "Birincil Malzeme ve Veri Kaynakları",
    shortLabel: "Birincil Malzeme",
    description:
      "Ampirik belgeleri, arşiv metinlerini, parti/kurum kayıtlarını ve saha verilerini gruplayan havuz.",
    icon: BookOpen,
    accentColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
};

/**
 * Resolves the quadrant configuration for a box type, falling back to a generic
 * muted configuration (using the supplied label) for unknown box types.
 */
export function getQuadrantConfig(
  boxType: ThesisBoxType | string | null | undefined,
  fallbackLabel = "",
): QuadrantConfig {
  const config = QUADRANTS[boxType ?? ""];
  if (config) return config;
  return {
    ...FALLBACK_QUADRANT_CONFIG,
    label: fallbackLabel,
    shortLabel: fallbackLabel,
  };
}
