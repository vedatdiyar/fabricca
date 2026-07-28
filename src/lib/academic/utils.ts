export function extractCleanDoi(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/10\.\d{4,}[^\s]*/i);
  return match ? match[0].replace(/\.$/, "") : null;
}

export interface CrossrefPerson {
  given?: string;
  family?: string;
}

export function formatAuthorName(person: CrossrefPerson): string {
  return `${(person.given ?? "").trim()} ${(person.family ?? "").trim()}`.trim();
}

export function formatAuthorList(
  persons: CrossrefPerson[] | undefined,
): string[] {
  if (!persons || persons.length === 0) return [];
  return persons.map(formatAuthorName).filter(Boolean);
}

export function extractCrossrefYear(
  obj: Record<string, unknown>,
): number | null {
  const issuedOrPublished = (obj.issued ?? obj.published) as
    { "date-parts"?: number[][] } | undefined;
  const dateParts = issuedOrPublished?.["date-parts"]?.[0];
  if (dateParts?.[0]) return dateParts[0];
  return null;
}

/**
 * Strips the alternative language title from a bilingual thesis title.
 * TEZARA returns titles in "Türkçe Başlık / English Title" format.
 * Returns only the primary (Turkish) portion.
 */
export function stripAltTitle(title: string | null | undefined): string {
  if (!title) return "";
  const idx = title.indexOf(" / ");
  return idx === -1 ? title.trim() : title.slice(0, idx).trim();
}

interface SortableResource {
  isFoundational: boolean | null;
  relevanceScore: number | null;
  id: number;
  badge?: string | null;
}

/**
 * Shared academic sort: foundational first, then thesis (has a badge),
 * then relevanceScore descending, then id ascending.
 * Used by both library actions and dashboard to keep sort order consistent.
 */
export function sortLibraryResources<T extends SortableResource>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    if (a.isFoundational && !b.isFoundational) return -1;
    if (!a.isFoundational && b.isFoundational) return 1;

    if (!a.isFoundational && !b.isFoundational) {
      const isThesisA = !!a.badge;
      const isThesisB = !!b.badge;
      if (isThesisA && !isThesisB) return -1;
      if (!isThesisA && isThesisB) return 1;
    }

    const scoreA = a.relevanceScore ?? 0;
    const scoreB = b.relevanceScore ?? 0;
    if (scoreA !== scoreB) return scoreB - scoreA;

    return a.id - b.id;
  });
}

/**
 * Tokenizes a title for containment comparison: lowercase, strip punctuation,
 * split by whitespace, keep only tokens ≥ 3 characters.
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
 * Containment similarity: intersection / min(len(A), len(B)).
 * Score = 1.0 when the shorter title is a complete subset of the longer one.
 * Ideal for catching edition/version duplicates where one title
 * appends extra info (e.g. "of Antonio Gramsci", subtitles, etc.).
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
 * Returns true when the containment similarity between two titles meets
 * or exceeds the given threshold. Used for edition/version deduplication.
 *
 * @param titleA - First title to compare
 * @param titleB - Second title to compare
 * @param threshold - Minimum similarity score (0.0–1.0) to consider them duplicates
 * @returns True if the titles are considered sufficiently similar
 */
export function areTitlesSimilar(
  titleA: string,
  titleB: string,
  threshold = 0.8,
): boolean {
  return containmentSimilarity(titleA, titleB) >= threshold;
}

/**
 * Resolves OpenAlex abstract_inverted_index back to plain text.
 * Each word is placed at its position index, returning the reconstituted text.
 * Returns null if the index is empty or null.
 * Limited to the first 120 words for token efficiency.
 */
export function resolveAbstractInvertedIndex(
  invertedIndex: Record<string, number[]> | null | undefined,
): string | null {
  if (!invertedIndex) return null;
  const entries = Object.entries(invertedIndex);
  if (entries.length === 0) return null;
  const maxPos = Math.max(...entries.flatMap(([, positions]) => positions));
  const words: string[] = new Array(maxPos + 1).fill("");
  for (const [word, positions] of entries) {
    for (const pos of positions) {
      if (pos >= 0 && pos <= maxPos) words[pos] = word;
    }
  }
  const fullText = words.join(" ").replace(/\s+/g, " ").trim();
  return fullText.split(/\s+/).slice(0, 120).join(" ");
}

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
 * Strips subtitles (separated by ':', '/', or ' - ') to extract the core title,
 * then normalizes it. Useful for cross-edition / duplicate matching where subtitles
 * may differ (e.g. "Security as Practice: Discourse Analysis..." vs "Security as Practice").
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
