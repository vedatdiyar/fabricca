import { Target, Compass, Database, BookOpen } from "lucide-react";
import type { ThesisMatrix } from "@/lib/types";

export interface QuadrantConfig {
  key: keyof ThesisMatrix;
  number: string;
  icon: typeof Target;
  title: string;
  placeholder: string;
  rows: number;
  required?: boolean;
}

export const QUADRANTS: QuadrantConfig[] = [
  {
    key: "subjectProblem",
    number: "01",
    icon: Target,
    title: "Araştırma Problemi, Aktörler ve Odak",
    placeholder:
      "Araştırmanın çözmeyi hedeflediği temel kuramsal veya pratik mesele, çalışmanın odaklandığı aktörler ve problem sahası...",
    rows: 5,
    required: true,
  },
  {
    key: "theoreticalFramework",
    number: "02",
    icon: Compass,
    title: "Teorik ve Kavramsal Çerçeve",
    placeholder:
      "Çalışmanın yaslandığı kavramsal paradigma, temel teoriler ve anahtar kavramlar...",
    rows: 5,
  },
  {
    key: "primaryMaterial",
    number: "03",
    icon: Database,
    title: "Veri Kaynağı / Birincil Malzeme",
    placeholder:
      "İncelenecek arşiv belgeleri, saha görüşmeleri, anket verileri veya metin külliyatı...",
    rows: 4,
  },
  {
    key: "methodology",
    number: "04",
    icon: BookOpen,
    title: "Metodoloji ve Araştırma Yöntemi",
    placeholder:
      "Verilerin toplanma, analiz edilme ve kuramla buluşturulma yöntemi...",
    rows: 5,
    required: true,
  },
];
