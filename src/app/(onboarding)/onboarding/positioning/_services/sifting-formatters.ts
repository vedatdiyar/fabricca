import type { TezaraThesisDetails } from "@/lib/types";
import type { PositioningQuery } from "./query-generator";
import type { PositioningMatrixInput } from "./validation";

/**
 * Sanitizes query text for vector search.
 *
 * @param rawQuery - The raw query string to sanitize.
 * @returns The cleaned query string.
 */
export function sanitizeSearchQuery(rawQuery: string): string {
  if (!rawQuery) return "";
  return rawQuery
    .replace(/\b(OR|AND|NOT)\b/gi, " ")
    .replace(/[+*?:^~={}[\]()"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Formats a thesis's title and abstract into a YAML document for reranking.
 *
 * @param thesis - The thesis to format.
 * @returns The formatted YAML string.
 */
export function formatThesisToYaml(thesis: TezaraThesisDetails): string {
  return [`Title: ${thesis.title}`, `Abstract: ${thesis.abstract}`].join("\n");
}

/**
 * Formats the multi-aspect positioning query and matrix into a rich YAML query for Cohere cross-encoder reranking.
 *
 * @param query - The generated positioning query containing empirical sub-queries and substantive keywords.
 * @param input - The validated positioning matrix input.
 * @returns The formatted YAML query string.
 */
export function formatMatrixToYamlQuery(
  query: PositioningQuery,
  input: PositioningMatrixInput,
): string {
  const lines = [
    `ResearchFocus: ${query.primaryEmpiricalQuery} ${query.actorsAndSourcesQuery}`,
    `SubstantiveKeywords: ${query.substantiveKeywords.join(", ")}`,
    `SubjectProblem: ${input.subjectProblem}`,
  ];
  return lines.join("\n");
}
