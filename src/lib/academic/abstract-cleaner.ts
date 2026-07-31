/**
 * Utility to clean common prefix labels (e.g. "Abstract", "ABSTRACT:", "SUMMARY -", "Özet:", etc.)
 * and trailing clutter from raw academic abstracts.
 */
export function cleanAbstractPrefix(
  text: string | null | undefined,
): string | null {
  if (!text) return null;

  let cleaned = text.trim();
  if (!cleaned) return null;

  // 1. Remove HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, "");

  // 2. Normalize escape sequences and whitespace (\n\n, \r, \\n, \\r, tabs)
  cleaned = cleaned
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();

  // 3. Remove common leading labels (case-insensitive)
  // Handles: Abstract, ABSTRACT, SUMMARY, Özet, ÖZET, Background, Overview, Context, Description
  // followed by optional punctuation (: - — . =) or whitespace
  const prefixRegex =
    /^(abstract|summary|özet|resumen|résumé|background|overview|context|description)[\s\:\-\_–—\.\=]*/i;

  cleaned = cleaned.replace(prefixRegex, "");
  // Apply a second pass in case of stacked prefixes (e.g. "Abstract - Background:")
  cleaned = cleaned.replace(prefixRegex, "");

  // 4. Clean trailing dangling commas or hyphens
  cleaned = cleaned.replace(/[\s,\-\–—]+$/, "").trim();

  return cleaned || null;
}
