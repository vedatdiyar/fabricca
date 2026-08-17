import { stripAltTitle } from "./title-utils";

/**
 * Converts a word into an ASCII-safe, Turkish-normalized alphanumeric form.
 *
 * @param str - Input word.
 * @returns ASCII-converted alphanumeric string.
 */
export function toAsciiWord(str: string): string {
  const turkishMap: Record<string, string> = {
    ç: "c",
    Ç: "C",
    ğ: "g",
    Ğ: "G",
    ı: "i",
    I: "I",
    İ: "I",
    ö: "o",
    Ö: "O",
    ş: "s",
    Ş: "S",
    ü: "u",
    Ü: "U",
  };
  const converted = str
    .split("")
    .map((c) => turkishMap[c] || c)
    .join("");

  return converted
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
}

/**
 * Extracts the surname from a full name.
 *
 * @param fullName - Full name string.
 * @returns Surname, or "Anonim" when none can be derived.
 */
export function extractSurname(fullName: string): string {
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Anonim";
  const rawSurname = parts[parts.length - 1];
  return toAsciiWord(rawSurname) || "Anonim";
}

/**
 * Formats an academic resource into an APA-style PDF filename.
 *
 * @param authors - Author names.
 * @param publicationYear - Publication year.
 * @param title - Resource title.
 * @returns APA-styled filename string.
 */
export function formatApaPdfFileName(
  authors: string[] | null | undefined,
  publicationYear: number | null | undefined,
  title: string,
): string {
  const year =
    publicationYear && publicationYear > 1000
      ? publicationYear
      : new Date().getFullYear();

  const cleanAuthors = (authors || []).map((a) => a.trim()).filter(Boolean);
  let authorPart = "Anonim";

  if (cleanAuthors.length === 1) {
    authorPart = extractSurname(cleanAuthors[0]);
  } else if (cleanAuthors.length === 2) {
    authorPart = `${extractSurname(cleanAuthors[0])}_and_${extractSurname(cleanAuthors[1])}`;
  } else if (cleanAuthors.length >= 3) {
    authorPart = `${extractSurname(cleanAuthors[0])}_et_al`;
  }

  const cleanTitle = stripAltTitle(title);
  const words = cleanTitle
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 5)
    .map(toAsciiWord)
    .filter(Boolean);

  const titlePart = words.length > 0 ? words.join("_") : "Eser";

  return `${authorPart}_${year}_${titlePart}.pdf`;
}
