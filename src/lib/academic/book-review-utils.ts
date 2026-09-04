/**
 * Academic book review and event detection patterns.
 * Identifies book reviews, conference announcements, and call for papers
 * to enable canonical parent monograph resolution and prevent secondary reviews
 * from contaminating primary research pools.
 */

const BOOK_REVIEW_TITLE_PATTERNS = [
  /\bbook\s+review\b/i,
  /\breview\s+article\b/i,
  /^review:\s+/i,
  /\bby\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s*$/i,
];

const NON_RESEARCH_EVENT_TITLE_PATTERNS = [
  /\bcolloque\b/i,
  /\bconference\b/i,
  /\bcall for papers\b/i,
  /\broundtable\b/i,
];

/**
 * Patterns matching book review abstracts.
 * Tightened to avoid false positives on journal article citations that contain
 * page ranges like "pp. 129-138". Requires book metadata (price, cloth/paper, ISBN, or explicit review header).
 */
const BOOK_REVIEW_ABSTRACT_PATTERNS = [
  /\b(REVIEWED BY|Reviewed by|Review of the book|This review covers)\b/i,
  /\$\s*\d+(\.\d+)?\s*(cloth|paper|hardcover|pb)\b/i,
  /\b(cloth|paper|hardcover|pb)\s*[,.]?\s*\$\s*\d+/i,
  /\bISBN\s*[\d-]+\b/i,
];

/**
 * Determines whether a paper is a book review based on title or abstract indicators.
 *
 * @param title - Paper title.
 * @param abstract - Optional paper abstract.
 * @returns True when the candidate is an academic book review.
 */
export function isBookReview(
  title: string | null | undefined,
  abstract: string | null | undefined,
): boolean {
  if (title && BOOK_REVIEW_TITLE_PATTERNS.some((p) => p.test(title))) {
    return true;
  }
  if (
    abstract &&
    BOOK_REVIEW_ABSTRACT_PATTERNS.some((p) => p.test(abstract.slice(0, 300)))
  ) {
    return true;
  }
  return false;
}

/**
 * Determines whether a paper title indicates a conference, colloquium, or call for papers.
 *
 * @param title - Paper title.
 * @returns True when the title indicates a non-research academic event.
 */
export function isNonResearchEvent(title: string | null | undefined): boolean {
  if (!title) return false;
  return NON_RESEARCH_EVENT_TITLE_PATTERNS.some((p) => p.test(title));
}
