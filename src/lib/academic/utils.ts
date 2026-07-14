export function extractCleanDoi(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/10\.\d{4,}[^\s]*/i);
  return match ? match[0].replace(/\.$/, "") : null;
}

export interface CrossrefPerson {
  given?: string;
  family?: string;
}

export function formatAuthorName(person: CrossrefPerson): string {
  return `${(person.given ?? "").trim()} ${(person.family ?? "").trim()}`.trim();
}

export function formatAuthorList(
  persons: CrossrefPerson[] | undefined,
): string[] {
  if (!persons || persons.length === 0) return [];
  return persons.map(formatAuthorName).filter(Boolean);
}

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
 * Strips the alternative language title from a bilingual thesis title.
 * TEZARA returns titles in "Türkçe Başlık / English Title" format.
 * Returns only the primary (Turkish) portion.
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
  badge?: string | null;
}

/**
 * Shared academic sort: foundational first, then thesis (has a badge),
 * then relevanceScore descending, then id ascending.
 * Used by both library actions and dashboard to keep sort order consistent.
 */
export function sortLibraryResources<T extends SortableResource>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    if (a.isFoundational && !b.isFoundational) return -1;
    if (!a.isFoundational && b.isFoundational) return 1;

    if (!a.isFoundational && !b.isFoundational) {
      const isThesisA = !!a.badge;
      const isThesisB = !!b.badge;
      if (isThesisA && !isThesisB) return -1;
      if (!isThesisA && isThesisB) return 1;
    }

    const scoreA = a.relevanceScore ?? 0;
    const scoreB = b.relevanceScore ?? 0;
    if (scoreA !== scoreB) return scoreB - scoreA;

    return a.id - b.id;
  });
}

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
