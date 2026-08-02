import { cleanAbstractPrefix } from "./abstract-cleaner";

/**
 * Extracts a clean DOI string from a raw value.
 *
 * @param raw - Raw DOI value from any source.
 * @returns The normalized DOI, or null when no DOI is present.
 */
export function extractCleanDoi(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/10\.\d{4,}[^\s]*/i);
  return match ? match[0].replace(/\.$/, "") : null;
}

/**
 * Extracts the canonical short OpenAlex work ID from a URL, plain ID, or junk value.
 *
 * @param raw - Raw OpenAlex identifier or URL.
 * @returns The extracted W... ID, or null when the input is invalid.
 */
export function extractOpenAlexId(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (trimmed === "" || trimmed === "null") return null;
  const match = trimmed.match(/(?:^|\/)(W\d+)$/i);
  if (match) return match[1];
  return /^W\d+$/i.test(trimmed) ? trimmed : null;
}

export interface CrossrefPerson {
  given?: string;
  family?: string;
}

/**
 * Formats a person's given and family names into a single trimmed string.
 *
 * @param person - Crossref person record.
 * @returns Combined full name.
 */
export function formatAuthorName(person: CrossrefPerson): string {
  return `${(person.given ?? "").trim()} ${(person.family ?? "").trim()}`.trim();
}

/**
 * Maps a list of Crossref persons to formatted full names, dropping empty entries.
 *
 * @param persons - Optional Crossref person records.
 * @returns Array of formatted author names.
 */
export function formatAuthorList(
  persons: CrossrefPerson[] | undefined,
): string[] {
  if (!persons || persons.length === 0) return [];
  return persons.map(formatAuthorName).filter(Boolean);
}

/**
 * Extracts the issued or published year from a Crossref record.
 *
 * @param obj - Crossref record object.
 * @returns The publication year, or null when unavailable.
 */
export function extractCrossrefYear(
  obj: Record<string, unknown>,
): number | null {
  const issuedOrPublished = (obj.issued ?? obj.published) as
    { "date-parts"?: number[][] } | undefined;
  const dateParts = issuedOrPublished?.["date-parts"]?.[0];
  if (dateParts?.[0]) return dateParts[0];
  return null;
}

/**
 * Strips the alternate-language portion from a bilingual thesis title (TEZARA "TR / EN" format).
 *
 * @param title - Raw thesis title in "TR / EN" format.
 * @returns The primary-language title.
 */
export function stripAltTitle(title: string | null | undefined): string {
  if (!title) return "";
  const idx = title.indexOf(" / ");
  return idx === -1 ? title.trim() : title.slice(0, idx).trim();
}

interface SortableResource {
  isFoundational: boolean | null;
  relevanceScore: number | null;
  id: number;
}

/**
 * Sorts academic resources: foundational first, then by relevance score, then by id.
 *
 * @param items - Resources to sort.
 * @returns A new array sorted by the shared academic ordering.
 */
export function sortLibraryResources<T extends SortableResource>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    if (a.isFoundational && !b.isFoundational) return -1;
    if (!a.isFoundational && b.isFoundational) return 1;

    const scoreA = a.relevanceScore ?? 0;
    const scoreB = b.relevanceScore ?? 0;
    if (scoreA !== scoreB) return scoreB - scoreA;

    return a.id - b.id;
  });
}

/**
 * Tokenizes a title into normalized lowercase tokens for containment matching.
 *
 * @param title - Raw title string.
 * @returns Set of normalized tokens.
 */
function tokenizeForContainment(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .filter((t) => t.length >= 3),
  );
}

/**
 * Computes containment similarity as intersection divided by the shorter title's token count.
 *
 * @param titleA - First title.
 * @param titleB - Second title.
 * @returns Similarity score between 0 and 1.
 */
export function containmentSimilarity(titleA: string, titleB: string): number {
  const tokensA = tokenizeForContainment(titleA);
  const tokensB = tokenizeForContainment(titleB);

  if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  const smaller = tokensA.size <= tokensB.size ? tokensA : tokensB;
  const larger = tokensA.size <= tokensB.size ? tokensB : tokensA;

  let intersection = 0;
  for (const token of smaller) {
    if (larger.has(token)) intersection++;
  }

  return intersection / Math.min(tokensA.size, tokensB.size);
}

/**
 * Returns whether the containment similarity between two titles meets a threshold.
 *
 * @param titleA - First title.
 * @param titleB - Second title.
 * @param threshold - Minimum similarity required (default 0.8).
 * @returns True when similarity is at or above the threshold.
 */
export function areTitlesSimilar(
  titleA: string,
  titleB: string,
  threshold = 0.8,
): boolean {
  return containmentSimilarity(titleA, titleB) >= threshold;
}

/**
 * Reconstitutes an OpenAlex abstract inverted index into plain text.
 *
 * @param invertedIndex - OpenAlex abstract word-position map.
 * @returns Reconstructed abstract text, or null when empty.
 */
export function resolveAbstractInvertedIndex(
  invertedIndex: Record<string, number[]> | null | undefined,
): string | null {
  if (!invertedIndex) return null;
  const entries = Object.entries(invertedIndex);
  if (entries.length === 0) return null;
  const maxPos = Math.max(...entries.flatMap(([, positions]) => positions));
  const words: string[] = new Array(maxPos + 1).fill("");
  for (const [word, positions] of entries) {
    for (const pos of positions) {
      if (pos >= 0 && pos <= maxPos) words[pos] = word;
    }
  }
  const fullText = words.join(" ").replace(/\s+/g, " ").trim();
  return cleanAbstractPrefix(fullText);
}

/**
 * Normalizes a title into a lowercase, punctuation-stripped string for matching.
 *
 * @param title - Raw title.
 * @param maxLength - Optional maximum length to keep.
 * @returns Normalized title string.
 */
export function normalizeTitle(
  title: string | null | undefined,
  maxLength?: number,
): string {
  if (!title) return "";
  let normalized = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (maxLength !== undefined && normalized.length > maxLength) {
    normalized = normalized.slice(0, maxLength);
  }
  return normalized;
}

/**
 * Strips the subtitle from a title, then normalizes the core title for duplicate matching.
 *
 * @param title - Raw title with optional subtitle.
 * @param maxLength - Optional maximum length to keep.
 * @returns Normalized core title.
 */
export function normalizeCleanTitle(
  title: string | null | undefined,
  maxLength?: number,
): string {
  if (!title) return "";
  let coreTitle = title;
  const separatorMatch = title.match(/^([^:/\-–—]+)/);
  if (separatorMatch && separatorMatch[1].trim().length >= 3) {
    coreTitle = separatorMatch[1].trim();
  }
  return normalizeTitle(coreTitle, maxLength);
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

/**
 * Extracts the surname from a full name.
 *
 * @param fullName - Full name string.
 * @returns Surname, or "Anonim" when none can be derived.
 */
function extractSurname(fullName: string): string {
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Anonim";
  const rawSurname = parts[parts.length - 1];
  return toAsciiWord(rawSurname) || "Anonim";
}

/**
 * Converts a word into an ASCII-safe, Turkish-normalized alphanumeric form.
 *
 * @param str - Input word.
 * @returns ASCII-converted alphanumeric string.
 */
function toAsciiWord(str: string): string {
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
