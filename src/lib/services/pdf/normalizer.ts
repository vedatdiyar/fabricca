/**
 * Normalizes extracted PDF text by repairing broken Turkish diacritics, OCR glyph separations, and line-break hyphens.
 *
 * @param text - Raw markdown text extracted from PDF.
 * @returns Cleaned and normalized markdown text.
 */
export function normalizeAcademicText(text: string): string {
  if (!text) return text;

  let normalized = text;

  // 1. Remove soft hyphens (\u00ad)
  normalized = normalized.replace(/\u00ad/g, "");

  // 2. Fix line-break hyphens: "kelime-\n  kelime" -> "kelimekelime"
  normalized = normalized.replace(/([\p{L}]+)-\s*\n\s*([\p{L}]+)/gu, "$1$2");

  // 3. Fix inline hyphens with spaces: "ba- ğımsız" -> "bağımsız"
  normalized = normalized.replace(/([\p{L}]+)-\s+([\p{L}]+)/gu, "$1$2");

  // 4. Rule A: 'ğ' / 'Ğ' NEVER starts any Turkish word. Any "word ğ..." is ALWAYS a broken word.
  // e.g., "bahsetti ği" -> "bahsettiği", "de ğil" -> "değil", "olmadı ğı" -> "olmadığı", "İmparatorlu ğun" -> "İmparatorluğun"
  normalized = normalized.replace(/([\p{L}]+)\s+([ğĞ][\p{L}]*)/gu, "$1$2");

  // 5. Rule B: Single isolated diacritic letter (ş, ğ, ı, ç, ö, ü, İ, Ş, Ç, Ö, Ü) after a stem.
  // e.g., "gezmi ş olan" -> "gezmiş olan", "birle şmi ş" -> "birleşmiş", "DÖNEM İ" -> "DÖNEMİ", "Kuruba ş" -> "Kurubaş"
  normalized = normalized.replace(
    /([\p{L}]+)\s+([şçöüıŞÇÖÜİ])(?=[\s\p{P}]|$)/gu,
    "$1$2",
  );

  // 6. Rule C: Non-dictionary consonant clusters starting with ş/ç: "şl", "şm", "şt", "şk", "şn", "şp", "şb", "şd", "şg", "şr", "şv", "şz", "çk", "çt", "çm", "çl"
  // e.g., "ba şlayan" -> "başlayan", "Danı şman" -> "Danışman", "geli şmiş" -> "gelişmiş"
  normalized = normalized.replace(
    /([\p{L}]+)\s+([şçŞÇ][bcdgklmnprstvzBCDGLMNPRSTVZ][\p{L}]*)/gu,
    "$1$2",
  );

  // 7. Rule D: Separated 'ş' / 'ç' suffixes starting with vowels or common suffix patterns:
  // e.g., "a şireti" -> "aşireti", "dü şüncesine" -> "düşüncesine", "geli şeceğini" -> "gelişeceğini", "ta şımıyordu" -> "taşımıyordu"
  const brokenSuffixes = [
    "şireti",
    "şiret",
    "şüncesine",
    "şüncesi",
    "şünce",
    "şeceğini",
    "şeceğini",
    "şeceği",
    "şımıyordu",
    "şımıyor",
    "şı",
    "şü",
    "şün",
    "şünü",
    "şünün",
    "şında",
    "şinde",
    "şından",
    "şinden",
    "şıl",
    "şılma",
    "şma",
    "şması",
    "şmasının",
    "şmak",
    "şmek",
    "şiyasal",
    "şiyasal",
  ];
  const suffixRegex = new RegExp(
    `([\\p{L}]+)\\s+(${brokenSuffixes.join("|")})(?=[\\s\\p{P}]|$)`,
    "giu",
  );
  normalized = normalized.replace(suffixRegex, "$1$2");

  // 8. Rule E: Uppercase title split letters: e.g., "HAREKET İNİN" -> "HAREKETİNİN", "DÖN ÜŞÜMÜ" -> "DÖNÜŞÜMÜ", "S İYASAL" -> "SİYASAL"
  normalized = normalized.replace(
    /([A-ZÇĞİÖŞÜ]{1,})\s+([İÜÖÇŞ][A-ZÇĞİÖŞÜ]+)/gu,
    (match, p1, p2) => {
      const standaloneUpperWords = new Set([
        "İRAN",
        "İSLAM",
        "İLİM",
        "İŞ",
        "İÇ",
        "ÖTE",
        "ÜÇ",
        "ŞU",
      ]);
      if (standaloneUpperWords.has(p2)) {
        return `${p1} ${p2}`;
      }
      return `${p1}${p2}`;
    },
  );

  return normalized;
}
