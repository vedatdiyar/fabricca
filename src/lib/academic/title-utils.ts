/**
 * Strips the alternate-language portion from a bilingual thesis title (TEZARA "TR / EN" format).
 *
 * @param title - Raw thesis title in "TR / EN" format.
 * @returns The primary-language title.
 */
export function stripAltTitle(title: string | null | undefined): string {
  if (!title) return "";
  const idx = title.indexOf(" / ");
  return idx === -1 ? title.trim() : title.slice(0, idx).trim();
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
 * Strips the subtitle from a title, then normalizes the core title for duplicate matching.
 *
 * @param title - Raw title with optional subtitle.
 * @param maxLength - Optional maximum length to keep.
 * @returns Normalized core title.
 */
export function normalizeCleanTitle(
  title: string | null | undefined,
  maxLength?: number,
): string {
  if (!title) return "";
  let coreTitle = title;
  const separatorMatch = title.match(/^([^:/\-–—]+)/);
  if (separatorMatch && separatorMatch[1].trim().length >= 3) {
    coreTitle = separatorMatch[1].trim();
  }
  return normalizeTitle(coreTitle, maxLength);
}
