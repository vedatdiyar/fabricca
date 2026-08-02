/**
 * Restores decomposed Turkish characters and combining accents into proper single-character Unicode glyphs.
 *
 * @param str - Text to normalize.
 * @returns Text with Turkish characters restored to single glyphs.
 */
export function normalizeTurkishText(str: string): string {
  if (!str) return str;

  return str
    .normalize("NFC")
    .replace(/g˘/g, "ğ")
    .replace(/G˘/g, "Ğ")
    .replace(/s¸/g, "ş")
    .replace(/S¸/g, "Ş")
    .replace(/c¸/g, "ç")
    .replace(/C¸/g, "Ç")
    .replace(/ı˙/g, "i")
    .replace(/I˙/g, "İ")
    .replace(/i˙/g, "i")
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
    .replace(/I\u0307/g, "İ");
}
