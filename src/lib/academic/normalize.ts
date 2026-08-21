/**
 * Central Turkish character normalization utilities.
 * Single source of truth for mapping Turkish-specific characters that do NOT
 * decompose under NFD (ı, İ, Ğ, ğ, Ş, ş, Ç, ç, Ö, ö, Ü, ü).
 * Domain-specific wrappers (filename, fuzzy dedup, search) delegate here.
 */

export const TURKISH_CHAR_MAP: Record<string, string> = {
  İ: "I",
  ı: "i",
  Ğ: "G",
  ğ: "g",
  Ş: "S",
  ş: "s",
  Ç: "C",
  ç: "c",
  Ö: "O",
  ö: "o",
  Ü: "U",
  ü: "u",
};

/**
 * Maps Turkish-specific characters to ASCII equivalents.
 * MUST be called BEFORE `String.prototype.normalize("NFD")` so that
 * characters like ı/İ are handled correctly.
 *
 * @param s - Input string.
 * @returns String with Turkish chars replaced.
 */
export function normalizeTurkishChars(s: string): string {
  return s
    .replace(/[İ]/g, "I")
    .replace(/[ı]/g, "i")
    .replace(/[Ğ]/g, "G")
    .replace(/[ğ]/g, "g")
    .replace(/[Ş]/g, "S")
    .replace(/[ş]/g, "s")
    .replace(/[Ç]/g, "C")
    .replace(/[ç]/g, "c")
    .replace(/[Ö]/g, "O")
    .replace(/[ö]/g, "o")
    .replace(/[Ü]/g, "U")
    .replace(/[ü]/g, "u");
}

/**
 * Full ASCII folding: Turkish map + NFD decomposition + combining diacritic strip.
 *
 * @param s - Input string.
 * @returns ASCII-folded string (preserves case; caller decides lowercasing).
 */
export function normalizeTurkishToAscii(s: string): string {
  return normalizeTurkishChars(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
