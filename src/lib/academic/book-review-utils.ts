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

/**
 * Trailing dash + person name used by journals for reviews
 * ("<Book Title> – <Book Author>"). Requires 2-3 capitalized words so
 * single-word subtitles ("- Turkey") and long subtitles are excluded.
 */
const DASH_AUTHOR_RE =
  /\s+[–—-]\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+){1,2})\s*$/;

const GENERIC_SUBTITLE_WORDS = new Set([
  "volume",
  "volumes",
  "vol",
  "edition",
  "part",
  "chapter",
  "section",
  "introduction",
  "conclusion",
  "preface",
  "foreword",
  "afterword",
  "appendix",
  "companion",
  "handbook",
  "reader",
  "guide",
  "overview",
  "collection",
  "essays",
  "studies",
  "library",
  "series",
]);

function normalizePersonToken(value: string): string {
  return value
    .toLocaleLowerCase("en")
    .replace(/[^a-zçğıöşü]+/gi, "");
}

function isGenericSubtitle(trailing: string): boolean {
  return trailing
    .split(/\s+/)
    .some((word) =>
      GENERIC_SUBTITLE_WORDS.has(normalizePersonToken(word)),
    );
}

function isSelfReference(
  trailing: string,
  authors: readonly string[],
): boolean {
  const trailingNorm = normalizePersonToken(trailing);
  const trailingSurname = normalizePersonToken(
    trailing.split(/\s+/).slice(-1)[0] ?? "",
  );
  return authors.some((author) => {
    const authorNorm = normalizePersonToken(author);
    if (!authorNorm) return false;
    if (authorNorm === trailingNorm) return true;
    const authorSurname = normalizePersonToken(
      author.trim().split(/\s+/).slice(-1)[0] ?? "",
    );
    return (
      authorSurname.length > 2 &&
      (authorSurname === trailingSurname || authorNorm.includes(trailingNorm))
    );
  });
}

function isDashAuthorReview(
  title: string,
  authors?: readonly string[] | null,
): boolean {
  const match = title.match(DASH_AUTHOR_RE);
  if (!match?.[1]) return false;
  const trailing = match[1].trim();
  if (isGenericSubtitle(trailing)) return false;
  if (authors && authors.length > 0 && isSelfReference(trailing, authors)) {
    return false;
  }
  return true;
}

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
 * Determines whether a paper is a book review based on title, abstract, or dash-author signals.
 *
 * @param title - Paper title.
 * @param abstract - Optional paper abstract.
 * @param authors - Optional paper author list used to guard the dash-author signal.
 * @returns True when the candidate is an academic book review.
 */
export function isBookReview(
  title: string | null | undefined,
  abstract: string | null | undefined,
  authors?: readonly string[] | null,
): boolean {
  if (title && BOOK_REVIEW_TITLE_PATTERNS.some((p) => p.test(title))) {
    return true;
  }
  if (title && isDashAuthorReview(title, authors)) {
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
