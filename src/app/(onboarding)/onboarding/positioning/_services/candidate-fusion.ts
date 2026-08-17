import type { TezaraThesisDetails } from "@/lib/types";

const ALLOWED_LANGUAGES = new Set([
  "tr",
  "tur",
  "turkish",
  "türkçe",
  "en",
  "eng",
  "english",
  "ingilizce",
]);

/**
 * Whether a thesis language tag matches Turkish or English; missing tags are kept.
 *
 * @param lang - The thesis language tag to check.
 * @returns True when the language is allowed or the tag is missing.
 */
export function isAllowedLanguage(lang?: string): boolean {
  if (!lang || !lang.trim()) {
    return true;
  }
  const normalized = lang
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLowerCase()
    .trim();
  return ALLOWED_LANGUAGES.has(normalized);
}

/**
 * Merges multiple ranked candidate lists using Reciprocal Rank Fusion (RRF) to eliminate single-query blind spots.
 *
 * @param rankedLists - Array of thesis candidate lists.
 * @param k - Smoothing constant (default: 60).
 * @returns Deduplicated and fused list of theses.
 */
export function reciprocalRankFusion(
  rankedLists: Array<TezaraThesisDetails[]>,
  k = 60,
): TezaraThesisDetails[] {
  const scoreMap = new Map<
    number,
    { thesis: TezaraThesisDetails; rrfScore: number }
  >();

  for (const list of rankedLists) {
    list.forEach((thesis, rank) => {
      const id = thesis.id;
      const current = scoreMap.get(id) || { thesis, rrfScore: 0 };
      current.rrfScore += 1 / (k + rank + 1);
      scoreMap.set(id, current);
    });
  }

  return Array.from(scoreMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map((item) => item.thesis);
}

/**
 * Filters candidates ensuring sufficient abstract length and supported languages.
 *
 * @param theses - Candidate theses to filter.
 * @returns Filtered candidate theses.
 */
export function filterValidCandidates(
  theses: TezaraThesisDetails[],
): TezaraThesisDetails[] {
  return theses.filter((thesis) => {
    const hasSufficientAbstract =
      thesis.abstract && thesis.abstract.trim().length >= 80;
    if (!hasSufficientAbstract) return false;

    const isValidLang = isAllowedLanguage(thesis.language);
    if (!isValidLang) return false;

    return true;
  });
}
