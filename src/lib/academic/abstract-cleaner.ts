/**
 * Utility to clean common prefix labels (e.g. "Abstract", "ABSTRACT:", "SUMMARY -", "Özet:", etc.)
 * and trailing clutter from raw academic abstracts.
 */
export function cleanAbstractPrefix(
  text: string | null | undefined,
): string | null {
  if (!text) return null;

  let cleaned = text.trim();

  // 1. Remove HTML tags if present
  cleaned = cleaned.replace(/<[^>]*>/g, "");

  // 2. Remove common leading labels (case-insensitive)
  // Handles: Abstract, ABSTRACT, SUMMARY, Özet, ÖZET, Background, Overview, Context, Description
  // followed by optional punctuation: :, -, —, ., =, or spaces
  const prefixRegex =
    /^(abstract|summary|özet|resumen|résumé|background|overview|context|description)[\s\:\-\_–—\.\=]*/i;

  cleaned = cleaned.replace(prefixRegex, "");
  // Apply a second pass in case of stacked prefixes (e.g. "Abstract - Background:")
  cleaned = cleaned.replace(prefixRegex, "");

  return cleaned.trim();
}
