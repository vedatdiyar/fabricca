/**
 * Joins PDF-style wrapped lines in pasted text while preserving paragraph breaks.
 *
 * @param text - Raw text copied from the clipboard.
 * @returns The cleaned text with wrapped lines joined into paragraphs.
 */
export function normalizePastedText(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n");

  return normalized
    .split(/\n\s*\n/)
    .map((paragraph) =>
      paragraph
        .replace(/-\n(?=\p{Ll})/gu, "")
        .replace(/\n+/g, " ")
        .replace(/[ \t]+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n\n");
}
