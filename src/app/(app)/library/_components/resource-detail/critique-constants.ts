import {
  Search,
  Layers,
  FlaskConical,
  Target,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { LibraryResourceCritique } from "../../_lib/types";

export interface CritiqueFieldConfig {
  key: "researchQuestion" | "theoreticalFramework" | "methodology" | "mainArgument" | "literatureGap";
  icon: LucideIcon;
  number: number;
  label: string;
  shortLabel: string;
  question: string;
  hint: string;
}

export const CRITIQUE_FIELDS: readonly CritiqueFieldConfig[] = [
  {
    key: "researchQuestion",
    icon: Search,
    number: 1,
    label: "Araştırma Sorusu",
    shortLabel: "Araştırma Sorusu",
    question: "Bu çalışma neyi çözmeye veya anlamaya çalışıyor?",
    hint: "Eserin temel problemini, yanıt aradığı ana soruyu ve inceleme gayesini yazınız.",
  },
  {
    key: "theoreticalFramework",
    icon: Layers,
    number: 2,
    label: "Teorik ve Kavramsal Çerçeve",
    shortLabel: "Teorik Çerçeve",
    question: "Hangi teoriye, kavramlara veya anahtar terimlere dayanıyor?",
    hint: "Yazarın başvurduğu kuramsal yaklaşımlar, temel kavramlar ve literatür referansları.",
  },
  {
    key: "methodology",
    icon: FlaskConical,
    number: 3,
    label: "Metodoloji",
    shortLabel: "Metodoloji",
    question: "Hangi yöntem, veri seti veya kaynaklar kullanılmış?",
    hint: "Araştırmanın veri toplama teknikleri, örneklem/arşiv seçimi ve analiz yöntemleri.",
  },
  {
    key: "mainArgument",
    icon: Target,
    number: 4,
    label: "Temel Argüman",
    shortLabel: "Temel Argüman",
    question: "Yazarın ulaştığı ana sonuç ve savunduğu temel tez nedir?",
    hint: "Metnin varoluş sebebi olan ana iddia, bulgular ve literatüre kattığı temel sav.",
  },
  {
    key: "literatureGap",
    icon: Sparkles,
    number: 5,
    label: "Literatür Boşluğu ve Sınırlar",
    shortLabel: "Literatür Boşluğu",
    question:
      "Yazar nerede eksik kalmış veya gelecekte ne yapılması gerektiğini söylemiş?",
    hint: "Çalışmanın sınırları, cevaplayamadığı noktalar ve tezinizin doldurabileceği boşluklar.",
  },
] as const;

export type CritiqueFieldKey = (typeof CRITIQUE_FIELDS)[number]["key"];

export type CritiqueDraftMap = Record<CritiqueFieldKey, string>;

/**
 * Extracts critique dimension draft values from a library resource record.
 *
 * @param critique - The saved analysis for the selected resource.
 * @returns Map of field keys to string values.
 */
export function toCritiqueFieldValues(
  critique?: LibraryResourceCritique,
): CritiqueDraftMap {
  return {
    researchQuestion: critique?.researchQuestion ?? "",
    theoreticalFramework: critique?.theoreticalFramework ?? "",
    methodology: critique?.methodology ?? "",
    mainArgument: critique?.mainArgument ?? "",
    literatureGap: critique?.literatureGap ?? "",
  };
}

/**
 * Calculates word count for a given text.
 *
 * @param text - The string to evaluate.
 * @returns Total number of whitespace-delimited words.
 */
export function getWordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
