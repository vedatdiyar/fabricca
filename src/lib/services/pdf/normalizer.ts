/**
 * Comprehensive normalization for Academic PDF extracts (Turkish & English).
 * Cleans Unicode artifacts, ligatures, OCR diacritic splits, punctuation boundaries,
 * and dash line-breaks.
 */
export function normalizeAcademicText(text: string): string {
  if (!text) return text;

  let normalized = text;

  // ==========================================
  // 1. UNICODE CLEANUP & LIGATURES
  // ==========================================
  // Remove soft hyphens, zero-width spaces, and BOM
  normalized = normalized.replace(/[\u00ad\u200b\u200c\u200d\ufeff]/g, "");

  // Normalize Unicode ligatures to standard letters (essential for English & Latin)
  const ligatures: Record<string, string> = {
    "\uFB00": "ff",
    "\uFB01": "fi",
    "\uFB02": "fl",
    "\uFB03": "ffi",
    "\uFB04": "ffl",
    "\uFB05": "ft",
    "\uFB06": "st",
  };
  normalized = normalized.replace(
    /[\uFB00-\uFB06]/g,
    (match) => ligatures[match] || match,
  );

  // Convert smart quotes/apostrophes to standard single/double quotes
  normalized = normalized
    .replace(/[\u2018\u2019\u201B\u02BC]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"');

  // Normalize Unicode superscripts to space-separated digits (e.g., "massa⁴" -> "massa ⁴")
  normalized = normalized.replace(/([\p{L}])([\u00B2\u00B3\u00B9\u2070-\u2079]+)/gu, "$1 $2");

  // ==========================================
  // 2. LINE-BREAK & HYPHEN REPAIRS
  // ==========================================
  // Fix line-break hyphens for all dash types (-, –, —, ‑): "kelime-\n kelime" -> "kelimekelime"
  normalized = normalized.replace(/([\p{L}]+)[-\u2013\u2014\u2011]\s*\n\s*([\p{L}]+)/gu, "$1$2");

  // Fix inline hyphens with spaces: "ba- ğımsız" -> "bağımsız", "multi- level" -> "multilevel"
  normalized = normalized.replace(/([\p{L}]+)[-\u2011]\s+([\p{L}]+)/gu, "$1$2");

  // Fix range hyphens between numbers: "18- 20", "18 - 20" -> "18-20"
  normalized = normalized.replace(/(\d+)\s*[-\u2013\u2014]\s*(\d+)/g, "$1-$2");

  // ==========================================
  // 3. ENGLISH SPECIFIC FIXES
  // ==========================================
  // Fix spaces before English contractions & possessives: "don 't" -> "don't", "author 's" -> "author's"
  normalized = normalized.replace(/([\p{L}]+)\s+'(s|t|re|ve|m|ll|d)\b/giu, "$1'$2");

  // Fix common OCR artifact: isolated 'ı' inside English words (e.g., "unıversıty" -> "university")
  // Converts 'ı' to 'i' if surrounded by Latin ASCII letters
  normalized = normalized.replace(/([a-zA-Z])ı([a-zA-Z])/g, "$1i$2");

  // ==========================================
  // 4. TURKISH PHONETIC & DIACRITIC RULES
  // ==========================================
  // Rule A: 'ğ' / 'Ğ' NEVER starts a Turkish word
  normalized = normalized.replace(/([\p{L}]+)\s+([ğĞ][\p{L}]*)/gu, "$1$2");

  // Rule B: Single isolated diacritic letter after a stem
  normalized = normalized.replace(
    /([\p{L}]+)\s+([şçöüıŞÇÖÜİ])(?=[\s\p{P}]|$)/gu,
    "$1$2",
  );

  // Rule C: Phonetic Dynamic Suffix Rule (Ş/Ç + Vowels/Consonant Clusters)
  normalized = normalized.replace(
    /([\p{L}]+)\s+([şçŞÇ][a-zçğıöşübcdgklmnprstvzA-ZÇĞİÖŞÜBCDGLMNPRSTVZ][\p{L}]*)/gu,
    "$1$2",
  );

  // Rule D: Uppercase title split letters (e.g., "DÖN ÜŞÜMÜ" -> "DÖNÜŞÜMÜ")
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

  // ==========================================
  // 5. TABLE ARTIFACTS & PIPE FIXES
  // ==========================================
  // Fix pipe-inserted mid-word breaks ("Kurtulu|ş" -> "Kurtuluş")
  normalized = normalized.replace(/(\p{L})\|(\p{L})/gu, "$1$2");

  // Collapse adjacent pipe artifacts ("||" -> "|")
  normalized = normalized.replace(/\|{2,}/g, "|");

  // ==========================================
  // 6. PUNCTUATION & BOUNDARY FIXES
  // ==========================================
  // Insert space after period/comma/colon if directly followed by an uppercase letter
  // Fixes: "yapılmıştır.Bu" -> "yapılmıştır. Bu", "analysis.The" -> "analysis. The"
  normalized = normalized.replace(/([\p{Ll}\d])([\.?!:])([\p{Lu}])/gu, "$1$2 $3");

  // Fix space-less words at lowercase-to-uppercase boundary ("Üniversitesiİ.İ.B.F." -> "Üniversitesi İ.İ.B.F.")
  normalized = normalized.replace(/([\p{Ll}])([\p{Lu}])/gu, "$1 $2");

  // Collapse multiple spaces into a single space (preserving newlines)
  normalized = normalized.replace(/[ \t]{2,}/g, " ");

  return normalized;
}