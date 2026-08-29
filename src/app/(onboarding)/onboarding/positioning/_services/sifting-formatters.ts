import type { MultiSourcePositioningQuery } from "./query-generator";
import type { PositioningMatrixInput } from "./validation";
import type { SiftedThesis } from "./sifting";

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
 * Formats the thesis matrix and multi-channel queries into structured YAML for Cohere Rerank v4.0 Pro.
 *
 * @param distilledQuery - The generated multi-aspect queries.
 * @param matrix - The original matrix.
 * @returns YAML formatted string representing the target query.
 */
export function formatMatrixToYamlQuery(
  distilledQuery: MultiSourcePositioningQuery,
  matrix: PositioningMatrixInput,
): string {
  return `arastirma_problemi: ${matrix.subjectProblem}
kuramsal_cerceve: ${matrix.theoreticalFramework || "Belirtilmemiş"}
yontem_ve_saha: ${matrix.methodology || "Belirtilmemiş"}
ampirik_odak: ${distilledQuery.thesisEmpiricalQuery}
kuresel_kuram: ${distilledQuery.globalTheoreticalQuery}
anahtar_kavramlar: ${distilledQuery.substantiveKeywords.join(", ")}`;
}

/**
 * Formats a candidate thesis or literature item into structured YAML for Cohere Rerank v4.0 Pro.
 *
 * @param candidate - The candidate literature item.
 * @returns YAML formatted string representing the candidate document.
 */
export function formatThesisToYaml(candidate: SiftedThesis): string {
  return `baslik: ${candidate.title}
yazar: ${candidate.author || "Bilinmiyor"} (${candidate.year || "N/A"})
yayin_turu: ${candidate.publicationType || candidate.thesisType || "Makale"}
kanal: ${candidate.sourceChannel || "Genel Literatür"}
kurum_veya_dergi: ${candidate.university || "N/A"}
ozet: ${candidate.abstract || ""}`;
}
