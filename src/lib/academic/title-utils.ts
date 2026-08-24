/**
 * Intelligently splits a bilingual thesis title (e.g., "Primary Title / Secondary Translated Title")
 * without breaking composite acronyms like "PKK/KCK" or short abbreviation slashes.
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

    if (
      words1.length >= 2 &&
      words2.length >= 2 &&
      part1.length >= 8 &&
      part2.length >= 8
    ) {
      splitPoints.push(splitIndex);
    }
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
