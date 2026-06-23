import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { OverlapLevel } from "@/lib/types";

export type ThesisBadge = "IKIZ" | "SINIRDAS" | "OZGUN";

export function calculateBadge(axes: {
  subject: OverlapLevel;
  theory: OverlapLevel;
  methodology: OverlapLevel;
  context?: OverlapLevel;
}): ThesisBadge {
  const c = axes.context ?? "OZGUN";
  if (
    axes.subject === "KRITIK" &&
    axes.theory === "KRITIK" &&
    axes.methodology === "KRITIK" &&
    c === "KRITIK"
  )
    return "IKIZ";
  if (axes.subject === "OZGUN" || c === "OZGUN") return "OZGUN";
  return "SINIRDAS";
}

/**
 * Tailwind CSS sınıflarını birleştirmek için yardımcı fonksiyon.
 * clsx ile koşullu sınıf birleştirmesi yapar,
 * tailwind-merge ile çelişen sınıfları çözer.
 *
 * @param inputs - Birleştirilecek sınıf değerleri
 * @returns Birleştirilmiş ve çözülmüş sınıf stringi
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * İki vektör arasındaki kosinüs benzerliğini (cosine similarity) hesaplar.
 *
 * @param vecA - Birinci vektör
 * @param vecB - İkinci vektör
 * @returns Kosinüs benzerlik skoru (-1 ile 1 arasında, 1 tam benzerliktir)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
