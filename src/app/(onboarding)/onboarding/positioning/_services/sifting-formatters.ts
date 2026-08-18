import type { TezaraThesisDetails } from "@/lib/types";
import type { PositioningQuery } from "./query-generator";
import type { PositioningMatrixInput } from "./validation";

/**
 * Sanitizes a search query string by removing quotes, wildcards, and normalizing whitespace.
 *
 * @param query - The raw query string.
 * @returns Sanitized query string.
 */
export function sanitizeSearchQuery(query: string): string {
  return query
    .replace(/["'*?[\]{}()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Formats the thesis matrix and distilled empirical topic queries into structured YAML
 * for Cohere Rerank v4.0 Pro, strictly comparing against the substantive subject matter and actors.
 *
 * @param distilledQuery - The generated multi-aspect queries.
 * @param matrix - The original matrix.
 * @returns YAML formatted string representing the target query.
 */
export function formatMatrixToYamlQuery(
  distilledQuery: PositioningQuery,
  matrix: PositioningMatrixInput,
): string {
  return `arastirma_konusu_ve_sorunsali: ${matrix.subjectProblem}
temel_olgusal_odak: ${distilledQuery.primaryEmpiricalQuery}
aktorler_ve_kurumlar: ${distilledQuery.actorsAndSourcesQuery}
donem_ve_vaka_baglami: ${distilledQuery.periodAndContextQuery}
konusal_anahtar_kavramlar: ${distilledQuery.substantiveKeywords.join(", ")}`;
}

/**
 * Formats a candidate thesis into structured YAML for Cohere Rerank v4.0 Pro.
 *
 * @param thesis - The candidate thesis from Tezara.
 * @returns YAML formatted string representing the candidate document.
 */
export function formatThesisToYaml(thesis: TezaraThesisDetails): string {
  return `baslik: ${thesis.title}
yazar: ${thesis.author || "Bilinmiyor"} (${thesis.year || "N/A"})
tur: ${thesis.thesisType || "N/A"}
universite_bolum: ${thesis.university || "N/A"} - ${thesis.department || "N/A"}
dil: ${thesis.language || "Türkçe"}
ozet: ${thesis.abstract || ""}`;
}
