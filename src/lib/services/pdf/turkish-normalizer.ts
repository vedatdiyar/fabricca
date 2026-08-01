/**
 * Normalizes decomposed Turkish characters, combining accents, and Unicode NFC forms.
 *
 * Many academic PDF files (especially from older databases like Taylor & Francis, JSTOR, ScienceDirect)
 * embed Turkish characters as decomposed glyphs (e.g. 'g' + combining breve accent -> 'g˘' or 's' + cedilla -> 's¸').
 * This function restores them into proper single-character Turkish Unicode glyphs.
 *
 * @param str - Input text string
 * @returns Cleaned string with normalized Turkish characters
 */
export function normalizeTurkishText(str: string): string {
  if (!str) return str;

  return (
    str
      // 1. Unicode Normalization (NFC: Canonical Composition)
      .normalize("NFC")

      // 2. Decomposed accent fixes for Turkish characters
      .replace(/g˘/g, "ğ")
      .replace(/G˘/g, "Ğ")
      .replace(/s¸/g, "ş")
      .replace(/S¸/g, "Ş")
      .replace(/c¸/g, "ç")
      .replace(/C¸/g, "Ç")
      .replace(/ı˙/g, "i")
      .replace(/I˙/g, "İ")
      .replace(/i˙/g, "i")

      // 3. Decomposed combining character sequences (Unicode combining diacritics)
      .replace(/g\u0306/g, "ğ")
      .replace(/G\u0306/g, "Ğ")
      .replace(/s\u0327/g, "ş")
      .replace(/S\u0327/g, "Ş")
      .replace(/c\u0327/g, "ç")
      .replace(/C\u0327/g, "Ç")
      .replace(/o\u0308/g, "ö")
      .replace(/O\u0308/g, "Ö")
      .replace(/u\u0308/g, "ü")
      .replace(/U\u0308/g, "Ü")
      .replace(/I\u0307/g, "İ")
  );
}
