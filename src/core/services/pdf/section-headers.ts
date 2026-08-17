export const HEADING_RE = /^(#{1,3})\s+(.+?)\s*$/;

export interface HeaderState {
  h1: string | null;
  h2: string | null;
  h3: string | null;
}

export const INITIAL_HEADER_STATE: HeaderState = {
  h1: null,
  h2: null,
  h3: null,
};

/**
 * Validates whether a markdown heading candidate is a legitimate academic section header
 * rather than layout noise (e.g. "İdaresi", "Antalya, 2014", standalone page numbers, or short words).
 *
 * @param title - The candidate header title string.
 * @returns True if the title appears to be a valid section header.
 */
export function isValidSectionHeader(title: string): boolean {
  if (!title) return false;
  const trimmed = title.trim();

  // 1. Minimum length requirement: must be at least 3 characters
  if (trimmed.length < 3) return false;

  // 2. Reject metadata, dates, city tags, or page number artifacts (e.g., "Antalya, 2014", "Sayfa 12", "s. 45")
  if (
    /^(Antalya|Ankara|İstanbul|İzmir|Erzurum|Diyarbakır|Konya|Sivas|Trabzon|Adana)[,\s]+\d{4}$/i.test(
      trimmed,
    ) ||
    /^(Sayfa|s\.|ss\.|Page)\s*\d+$/i.test(trimmed) ||
    /^(Yüksek Lisans|Doktora)\s+Tezi$/i.test(trimmed) ||
    /^(Ana Bilim Dalı|Enstitüsü|Fakültesi|Üniversitesi)$/i.test(trimmed)
  ) {
    return false;
  }

  // 3. Always accept numbered section titles (e.g. "1.", "1.2.", "1.2.1.", "A.", "B.", "III.")
  if (/^(\d+(\.\d+)*\.?|[A-Z]\.|[IVXLCDM]+\.)\s+/i.test(trimmed)) {
    return true;
  }

  // 4. Always accept standard major academic headings
  if (
    /^(GİRİŞ|SONUÇ|KAYNAKÇA|KAYNAKLAR|REFERANSLAR|ATIFLAR|ÖZET|ABSTRACT|ÖNSÖZ|İÇİNDEKİLER|BÖLÜM\s+\d+|GİRİŞ VE AMAÇ|METODOLOJİ|BULGULAR|TARTIŞMA|REFERENCES|BIBLIOGRAPHY|INTRODUCTION|CONCLUSION)\b/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  // 5. For non-numbered, non-standard titles: reject single isolated common words (like "İdaresi", "Yapısı", "Hakkında", "Ayrıca")
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount === 1) {
    // Single word titles are only valid if > 12 characters or uppercase major section
    if (trimmed.length <= 12 && !/^[A-ZÇĞİÖŞÜ]{4,}$/.test(trimmed)) {
      return false;
    }
  }

  return true;
}

/**
 * Updates the header state when a markdown heading block is encountered.
 *
 * @param state - Current header state.
 * @param block - The markdown block to check.
 * @returns Updated header state.
 */
export function updateHeaderState(
  state: HeaderState,
  block: string,
): HeaderState {
  const match = HEADING_RE.exec(block);
  if (!match) return state;

  const level = match[1].length;
  const title = match[2].slice(0, 120).trim();

  if (!isValidSectionHeader(title)) return state;

  if (level === 1) return { h1: title, h2: null, h3: null };
  if (level === 2) return { ...state, h2: title, h3: null };
  return { ...state, h3: title };
}

/**
 * Builds the header hierarchy array from the current state.
 *
 * @param state - Current header state.
 * @returns Array of active heading titles from H1 down to the deepest level.
 */
export function buildHeaderHierarchy(state: HeaderState): string[] {
  const hierarchy: string[] = [];
  if (state.h1) hierarchy.push(state.h1);
  if (state.h2) hierarchy.push(state.h2);
  if (state.h3) hierarchy.push(state.h3);
  return hierarchy;
}

/**
 * Returns the deepest section title from the header state.
 *
 * @param state - Current header state.
 * @returns The most specific section title, or null when no heading has been seen.
 */
export function getSectionTitle(state: HeaderState): string | null {
  return state.h3 || state.h2 || state.h1 || null;
}
