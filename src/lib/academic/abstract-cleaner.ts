/**
 * Strips common prefix labels and trailing clutter from a raw academic abstract.
 *
 * @param text - Raw abstract text.
 * @returns The cleaned abstract, or null when empty.
 */
export function cleanAbstractPrefix(
  text: string | null | undefined,
): string | null {
  if (!text) return null;

  let cleaned = text.trim();
  if (!cleaned) return null;

  cleaned = cleaned.replace(/<[^>]*>/g, "");

  cleaned = cleaned
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();

  const prefixRegex =
    /^(abstract|summary|özet|resumen|résumé|background|overview|context|description)[\s\:\-\_–—\.\=]*/i;

  cleaned = cleaned.replace(prefixRegex, "");
  cleaned = cleaned.replace(prefixRegex, "");

  cleaned = cleaned.replace(/[\s,\-\–—]+$/, "").trim();

  return cleaned || null;
}
