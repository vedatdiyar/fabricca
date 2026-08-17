import { cleanAbstractPrefix } from "./abstract-cleaner";

/**
 * Reconstitutes an OpenAlex abstract inverted index into plain text.
 *
 * @param invertedIndex - OpenAlex abstract word-position map.
 * @returns Reconstructed abstract text, or null when empty.
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
  return cleanAbstractPrefix(fullText);
}
