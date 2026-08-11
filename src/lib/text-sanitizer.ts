/**
 * Strips stray Arabic/non-Latin glyph artifacts that occasionally leak into
 * Latin model output (a known Gemini tokenizer rendering quirk), without
 * touching legitimate standalone non-Latin words such as Arabic quotations.
 * Only Arabic runs embedded inside a Latin word are removed.
 *
 * @param text - Raw model stream output.
 * @returns The text with Arabic glyph runs inside Latin words removed.
 */
const ARABIC_ARTIFACT_RE =
  /([A-Za-z0-9ÇĞİÖŞÜçğıöşü])[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g;

export function sanitizeModelStreamText(text: string): string {
  if (!text) return text;
  return text.replace(ARABIC_ARTIFACT_RE, "$1");
}
