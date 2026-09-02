const TURKISH_CHARS_REGEX = /[çğıöşüÇĞİÖŞÜ]/;
const TURKISH_FUNCTION_WORDS =
  /\b(ve|veya|ile|bir|üzerine|için|göre|bu|şu|her|dair|hakkında|analizi|incelemesi|araştırması|yaklaşımı|değerlendirmesi|örneği|rolü|etkisi)\b/i;
const ENGLISH_FUNCTION_WORDS =
  /\b(the|of|and|in|to|for|with|a|an|on|by|from|at|as|into|through|during|analysis|study|approach|perspective|effects|impact|role|case|evaluation|investigation)\b/i;
const TURKISH_RELATIONAL_LINKERS =
  /\b(arasındaki|arasında|alanında|alanındaki|bağlamında|ilişkisi|karşılaştırması|kıyaslaması|mukayesesi|çerçevesinde|açısından)\b/i;

function hasEnglishMarkers(text: string): boolean {
  return ENGLISH_FUNCTION_WORDS.test(text);
}

function hasTurkishMarkers(text: string): boolean {
  return TURKISH_CHARS_REGEX.test(text) || TURKISH_FUNCTION_WORDS.test(text);
}

/**
 * Intelligently splits a bilingual thesis title (e.g., "Primary Title / Secondary Translated Title")
 * without breaking composite acronyms like "NATO/EU", "XYZ/ABC", or internal comparative phrases.
 *
 * @param rawTitle - Raw thesis title.
 * @returns An object containing mainTitle and optional secondaryTitle.
 */
export function splitBilingualTitle(rawTitle: string | null | undefined): {
  mainTitle: string;
  secondaryTitle?: string;
} {
  if (!rawTitle) return { mainTitle: "" };

  const trimmed = rawTitle.trim();
  const regex = /\s+\/\s+/g;
  let match: RegExpExecArray | null;
  const splitPoints: number[] = [];

  while ((match = regex.exec(trimmed)) !== null) {
    const splitIndex = match.index;
    const separatorLength = match[0].length;
    const part1 = trimmed.slice(0, splitIndex).trim();
    const part2 = trimmed.slice(splitIndex + separatorLength).trim();

    const words1 = part1.split(/\s+/).filter(Boolean);
    const words2 = part2.split(/\s+/).filter(Boolean);

    // Minimum word and character count guard
    if (
      words1.length < 2 ||
      words2.length < 2 ||
      part1.length < 8 ||
      part2.length < 8
    ) {
      continue;
    }

    // Check if this is a single compound sentence linked by relational postpositions (e.g. "X / Y arasındaki ilişki")
    const isPart2RelationalLinker = TURKISH_RELATIONAL_LINKERS.test(part2);
    const isBilingualCrossLanguage =
      (hasEnglishMarkers(part1) && hasTurkishMarkers(part2)) ||
      (hasTurkishMarkers(part1) && hasEnglishMarkers(part2));

    if (isPart2RelationalLinker && !isBilingualCrossLanguage) {
      // Not a bilingual split, but a relational compound title
      continue;
    }

    splitPoints.push(splitIndex);
  }

  if (splitPoints.length > 0) {
    let bestSplit = splitPoints[0];
    for (const sp of splitPoints) {
      const p1 = trimmed.slice(0, sp).trim();
      const matchAtSp = trimmed.slice(sp).match(/^\s+\/\s+/);
      const sepLen = matchAtSp ? matchAtSp[0].length : 3;
      const p2 = trimmed.slice(sp + sepLen).trim();
      const w1 = p1.split(/\s+/).filter(Boolean).length;
      const w2 = p2.split(/\s+/).filter(Boolean).length;
      if (w1 >= 3 && w2 >= 3) {
        bestSplit = sp;
        break;
      }
    }

    const matchAtBest = trimmed.slice(bestSplit).match(/^\s+\/\s+/);
    const sepLen = matchAtBest ? matchAtBest[0].length : 3;
    const mainTitle = trimmed.slice(0, bestSplit).trim();
    const secondaryTitle = trimmed.slice(bestSplit + sepLen).trim();

    return {
      mainTitle,
      secondaryTitle: secondaryTitle.length > 0 ? secondaryTitle : undefined,
    };
  }

  return { mainTitle: trimmed };
}

/**
 * Strips the alternate-language portion from a bilingual thesis title (YÖK "TR / EN" format).
 *
 * @param title - Raw thesis title in "TR / EN" format.
 * @returns The primary-language title.
 */
export function stripAltTitle(title: string | null | undefined): string {
  if (!title) return "";
  return splitBilingualTitle(title).mainTitle;
}

/**
 * Tokenizes a title into normalized lowercase tokens for containment matching.
 *
 * @param title - Raw title string.
 * @returns Set of normalized tokens.
 */
function tokenizeForContainment(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .filter((t) => t.length >= 3),
  );
}

/**
 * Computes containment similarity as intersection divided by the shorter title's token count.
 *
 * @param titleA - First title.
 * @param titleB - Second title.
 * @returns Similarity score between 0 and 1.
 */
export function containmentSimilarity(titleA: string, titleB: string): number {
  const tokensA = tokenizeForContainment(titleA);
  const tokensB = tokenizeForContainment(titleB);

  if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  const smaller = tokensA.size <= tokensB.size ? tokensA : tokensB;
  const larger = tokensA.size <= tokensB.size ? tokensB : tokensA;

  let intersection = 0;
  for (const token of smaller) {
    if (larger.has(token)) intersection++;
  }

  return intersection / Math.min(tokensA.size, tokensB.size);
}

/**
 * Returns whether the containment similarity between two titles meets a threshold.
 *
 * @param titleA - First title.
 * @param titleB - Second title.
 * @param threshold - Minimum similarity required (default 0.8).
 * @returns True when similarity is at or above the threshold.
 */
export function areTitlesSimilar(
  titleA: string,
  titleB: string,
  threshold = 0.8,
): boolean {
  return containmentSimilarity(titleA, titleB) >= threshold;
}

/**
 * Tokenizes normalized title into word set for Jaccard.
 *
 * @param title - Raw title.
 * @returns Set of lowercase word tokens.
 */
function tokenizeForJaccard(title: string): Set<string> {
  const clean = normalizeTitle(title);
  if (!clean) return new Set();
  return new Set(clean.split(/\s+/).filter(Boolean));
}

/**
 * Computes Jaccard similarity (word-set) between two titles: |A∩B| / |A∪B|.
 *
 * @param titleA - First title.
 * @param titleB - Second title.
 * @returns Similarity 0..1.
 */
export function jaccardSimilarity(titleA: string, titleB: string): number {
  const setA = tokenizeForJaccard(titleA);
  const setB = tokenizeForJaccard(titleB);
  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;
  let intersection = 0;
  for (const tok of setA) if (setB.has(tok)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Levenshtein edit distance (DP, O(n*m)).
 *
 * @param a - First normalized string.
 * @param b - Second normalized string.
 * @returns Edit distance.
 */
export function levenshteinDistance(a: string, b: string): number {
  const s = normalizeTitle(a);
  const t = normalizeTitle(b);
  const n = s.length;
  const m = t.length;
  if (n === 0) return m;
  if (m === 0) return n;
  let prev = Array.from({ length: m + 1 }, (_, i) => i);
  let curr = new Array(m + 1);
  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    for (let j = 1; j <= m; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[m];
}

/**
 * Normalized Levenshtein similarity: 1 - distance / maxLen.
 *
 * @param titleA - First title.
 * @param titleB - Second title.
 * @returns Similarity 0..1.
 */
export function normalizedLevenshteinSimilarity(
  titleA: string,
  titleB: string,
): number {
  const s = normalizeTitle(titleA);
  const t = normalizeTitle(titleB);
  const maxLen = Math.max(s.length, t.length);
  if (maxLen === 0) return 1.0;
  return 1 - levenshteinDistance(s, t) / maxLen;
}

/**
 * Metric-based title similarity — Jaccard word-set primary, Levenshtein fallback.
 * Threshold is 0.90 per spec to avoid false duplicates like "Yapay Zeka: Tıpta Devrim" vs "Yapay Zeka: Hukukta Dönüşüm".
 *
 * @param titleA - First title.
 * @param titleB - Second title.
 * @param threshold - Minimum similarity (default 0.90).
 * @returns True when Jaccard or normalized Levenshtein meets threshold.
 */
export function areTitlesDuplicateByMetric(
  titleA: string,
  titleB: string,
  threshold = 0.90,
): boolean {
  const jaccard = jaccardSimilarity(titleA, titleB);
  if (jaccard >= threshold) return true;
  // Fallback to Levenshtein for punctuation/typo variants
  return normalizedLevenshteinSimilarity(titleA, titleB) >= threshold;
}

/**
 * Normalizes a title into a lowercase, punctuation-stripped string for matching.
 *
 * @param title - Raw title.
 * @param maxLength - Optional maximum length to keep.
 * @returns Normalized title string.
 */
export function normalizeTitle(
  title: string | null | undefined,
  maxLength?: number,
): string {
  if (!title) return "";
  let normalized = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (maxLength !== undefined && normalized.length > maxLength) {
    normalized = normalized.slice(0, maxLength);
  }
  return normalized;
}

/**
 * Normalizes a title for duplicate matching — preserves the full title (no colon/dash truncation).
 * Only lowercases, strips punctuation and collapses whitespace.
 *
 * @param title - Raw title with optional subtitle.
 * @param maxLength - Optional maximum length to keep.
 * @returns Normalized full title.
 */
export function normalizeCleanTitle(
  title: string | null | undefined,
  maxLength?: number,
): string {
  if (!title) return "";
  // Spec: cleanTitle = title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim()
  return normalizeTitle(title, maxLength);
}
