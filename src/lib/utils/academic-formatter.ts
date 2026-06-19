/**
 * Academic title formatter utility to normalize paper titles
 * in accordance with APA 7 and Turkish Language Association (TDK) academic standards.
 */

const LOWERCASE_WORDS = new Set([
  "ve",
  "veya",
  "yahut",
  "velev",
  "ile",
  "de",
  "da",
  "ki",
  "ise",
  "mı",
  "mi",
  "mu",
  "mü",
  "mısın",
  "misin",
  "musun",
  "müsün",
  "böylece",
  "zira",
  "çünkü",
  "meğer",
  "illaki",
  "mademki",
  "halbuki",
  "için",
  "gibi",
  "kadar",
  "beri",
  "diye",
  "üzere",
  "sanki",
  "and",
  "but",
  "or",
  "nor",
  "for",
  "yet",
  "so",
  "a",
  "an",
  "the",
  "as",
  "at",
  "by",
  "in",
  "of",
  "on",
  "per",
  "to",
  "up",
  "via",
  "am",
  "is",
  "are",
  "vs",
  "vs.",
  "v",
  "v.",
  "ex",
]);

/**
 * Capitalizes the first character of a word using Turkish locale rules.
 *
 * @param word - The word to capitalize
 * @returns Capitalized word string
 */
function capitalize(word: string): string {
  if (!word) return "";
  return (
    word.charAt(0).toLocaleUpperCase("tr-TR") + word.slice(1).toLowerCase()
  );
}

/**
 * Normalizes academic titles to match APA 7 / TDK standards.
 * Solves character inconsistencies (ALL CAPS, all lowercase, etc.)
 * by preserving conjunctions and title cases.
 *
 * @param text - The raw title string
 * @returns Normalized title string
 */
export function formatAcademicTitle(text: string): string {
  if (!text) return "";
  const workingTitle = text === text.toUpperCase() ? text.toLowerCase() : text;
  const words = workingTitle.trim().split(/\s+/);
  const lastIndex = words.length - 1;

  const processedWords = words.map((word, index) => {
    const cleanWord = word.toLowerCase().replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ]/g, "");
    if (index === 0 || index === lastIndex) return capitalize(word);
    if (index > 0 && words[index - 1].endsWith(":")) return capitalize(word);

    if (LOWERCASE_WORDS.has(cleanWord)) {
      if (word.includes("'")) {
        const parts = word.split("'");
        return parts[0].toLowerCase() + "'" + parts[1].toLowerCase();
      }
      return word.toLowerCase();
    }

    if (word.includes("'")) {
      const parts = word.split("'");
      return capitalize(parts[0]) + "'" + parts[1].toLowerCase();
    }
    return capitalize(word);
  });

  return processedWords.join(" ");
}
