/**
 * String normalization and similarity helpers for the literature pipeline.
 */

/** Cleans a title for Jaccard comparison by lowercasing and removing punctuation */
export function cleanTitleForJaccard(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Converts a title into a set of tokens (length > 2) for intersection */
export function tokenizeTitle(title: string): Set<string> {
  return new Set(
    cleanTitleForJaccard(title)
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

/** Jaccard similarity: intersection / union ratio of two token sets */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Extracts the primary author's surname from an authorship string */
export function extractPrimarySurname(authors: string[]): string | null {
  if (authors.length === 0) return null;
  const primary = authors[0].trim();
  const parts = primary.split(",").map((s) => s.trim());
  const surname = parts.length > 1 ? parts[0] : parts[0].split(/\s+/).pop();
  return surname?.toLowerCase() ?? null;
}
