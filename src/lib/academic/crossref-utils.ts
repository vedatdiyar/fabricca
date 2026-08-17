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
