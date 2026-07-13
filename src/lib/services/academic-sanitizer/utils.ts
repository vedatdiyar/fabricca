/**
 * Deterministic HTML tag cleaner.
 * Strips HTML tags and replaces them with a single space to prevent
 * words from concatenating, then collapses multi-space sequences.
 *
 * @param text - Raw string potentially containing HTML markup
 * @returns Clean string with HTML tags removed and whitespace normalised
 */
export function cleanHtmlTags(text: string): string {
  return text
    .replace(/(<([^>]+)>)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
