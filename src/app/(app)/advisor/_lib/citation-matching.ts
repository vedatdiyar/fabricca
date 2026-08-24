import type { RagSearchResultItem } from "@/core/services/search/rag-search";

/** Tailwind classes for clickable citation badges. */
export const CITATION_BADGE_CLASS =
  "inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-1 text-xs font-medium cursor-pointer hover:bg-primary/20 transition-colors select-none";

export const CITATION_ATTR = "data-source-index";

/**
 * Normalizes a string by stripping Turkish and Latin diacritics and casing.
 *
 * @param str - Input text.
 * @returns Normalized lowercase string.
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();
}

/**
 * Extracts the last name from a full author name string.
 *
 * @param author - Full author name (e.g. "Yılmaz, A." or "Ahmet Yılmaz").
 * @returns The last name portion.
 */
function extractLastName(author: string): string {
  const trimmed = author.trim();
  if (trimmed.includes(",")) {
    return trimmed.split(",")[0].trim();
  }
  const parts = trimmed.split(/\s+/);
  return parts.length > 0 ? parts[parts.length - 1] : trimmed;
}

/**
 * Matches a citation author string against a source's author list by normalized last name.
 *
 * @param citationAuthor - The author name from the citation text.
 * @param sourceAuthors - The source's resourceAuthors array.
 * @returns True if the normalized last names match.
 */
function matchesAuthor(
  citationAuthor: string,
  sourceAuthors: string[],
): boolean {
  const citationLast = normalizeString(extractLastName(citationAuthor));
  if (!citationLast) return false;

  return sourceAuthors.some((a) => {
    const sourceLast = normalizeString(extractLastName(a));
    return (
      sourceLast === citationLast ||
      sourceLast.includes(citationLast) ||
      citationLast.includes(sourceLast)
    );
  });
}

/**
 * Scores and finds the best matching RAG source index for a single citation reference.
 *
 * @param authorStr - Extracted author surname or name.
 * @param yearStr - Extracted 4-digit publication year.
 * @param pageRef - Extracted page number or page range string.
 * @param sources - Array of RAG source items.
 * @returns Index of matching source in sources array, or -1 if no match found.
 */
function matchSourceForCitation(
  authorStr: string,
  yearStr: string | null | undefined,
  pageRef: string | null | undefined,
  sources: RagSearchResultItem[],
): number {
  const citedPages: number[] = [];
  if (pageRef) {
    const pageNums = pageRef.match(/\d+/g);
    if (pageNums) {
      citedPages.push(...pageNums.map((n) => parseInt(n, 10)));
    }
  }
  const citedYear = yearStr ? parseInt(yearStr, 10) : null;

  let bestIdx = -1;
  let maxScore = -1;

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    let score = 0;

    if (!matchesAuthor(authorStr, source.resourceAuthors)) {
      continue;
    }
    score += 20;

    if (citedYear && source.resourceYear === citedYear) {
      score += 20;
    }

    if (citedPages.length > 0 && source.pageNumber) {
      const citedStart = citedPages[0];
      const citedEnd = citedPages[citedPages.length - 1];

      const match = /(\d{1,5})(?:\s*[-–]\s*(\d{1,5}))?/.exec(
        source.pageNumber,
      );
      if (match) {
        const pStart = Number(match[1]);
        const pEnd = match[2] ? Number(match[2]) : pStart;

        if (citedStart === pStart && citedEnd === pEnd) {
          score += 100;
        } else if (citedStart >= pStart && citedEnd <= pEnd) {
          score += 80;
        } else if (citedStart <= pEnd && citedEnd >= pStart) {
          score += 50;
        }
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestIdx = i;
    }
  }

  return bestIdx;
}

/**
 * Formats a bracket inner segment (potentially containing multiple citations separated by semicolons)
 * into individual clickable HTML badge spans.
 *
 * @param bracketText - Text contained inside brackets.
 * @param sources - RAG source items.
 * @returns Replacement HTML string with clickable badges.
 */
function formatBracketSegment(
  bracketText: string,
  sources: RagSearchResultItem[],
): string {
  const segments = bracketText.split(/;\s*/);
  const badges: string[] = [];

  for (const seg of segments) {
    const match = seg.match(
      /([A-Za-zÇçĞğİıÖöŞşÜü\s.]+?)(?:,\s*|\s+)(\d{4})(?:[,\s]*((?:s\.|ss\.|p\.|pp\.)\s*[\d\s,–-]+))?/i,
    );

    if (match) {
      const authorStr = match[1].trim();
      const year = match[2];
      let pageRef = match[3]?.trim();
      if (pageRef && (pageRef.endsWith(",") || pageRef.endsWith("."))) {
        pageRef = pageRef.replace(/[,.]+$/, "").trim();
      }

      const pagePart = pageRef ? `, ${pageRef}` : "";
      const badgeLabel = `(${authorStr}, ${year}${pagePart})`;
      const bestIdx = matchSourceForCitation(authorStr, year, pageRef, sources);

      if (bestIdx >= 0) {
        badges.push(
          `<span class="${CITATION_BADGE_CLASS}" role="button" tabindex="0" aria-label="${badgeLabel}" ${CITATION_ATTR}="${bestIdx}">${badgeLabel}</span>`,
        );
      } else {
        badges.push(
          `<span class="${CITATION_BADGE_CLASS}" role="button" tabindex="0" aria-label="${badgeLabel}">${badgeLabel}</span>`,
        );
      }
    } else {
      const authorOnlyMatch = seg.match(/^([A-Za-zÇçĞğİıÖöŞşÜü\s.]+?)$/);
      if (authorOnlyMatch) {
        const authorStr = authorOnlyMatch[1].trim();
        const bestIdx = matchSourceForCitation(authorStr, null, null, sources);
        if (bestIdx >= 0) {
          const badgeLabel = `(${authorStr})`;
          badges.push(
            `<span class="${CITATION_BADGE_CLASS}" role="button" tabindex="0" aria-label="${badgeLabel}" ${CITATION_ATTR}="${bestIdx}">${badgeLabel}</span>`,
          );
          continue;
        }
      }
      badges.push(seg);
    }
  }

  return badges.join(" ");
}

/**
 * Replaces inline academic citations with clickable HTML badge spans.
 * Uses a single-pass parser to avoid double-replacing or corrupting generated HTML tags.
 * Supports single brackets [Watts, 1999, s. 632], compound brackets [Watts, 1999; Gunes, 2018],
 * and standard parenthetical citations (Watts, 1999).
 *
 * @param content - Raw markdown string from the LLM.
 * @param sources - Array of RAG source items for matching.
 * @returns Processed markdown with citation badge spans.
 */
export function formatContent(
  content: string,
  sources: RagSearchResultItem[],
): string {
  // Escape numbers at start of lines followed by century words so Markdown doesn't parse them as <ol>
  const sanitizedContent = content.replace(
    /(^|\n)(\s*)(\d{1,2})\.\s+(yüzyıl|yy|asır)/gi,
    "$1$2$3\\. $4",
  );

  // Single-pass regex matching either bracket citations [ ... ] OR parenthetical citations ( ... )
  return sanitizedContent.replace(
    /\[([^\]\n]+)\]|\(([A-Za-zÇçĞğİıÖöŞşÜü\s.]+?,\s*\d{4}[^\)\n]*)\)/g,
    (
      match,
      bracketInner: string | undefined,
      parenInner: string | undefined,
    ) => {
      const inner = bracketInner || parenInner;
      if (!inner) return match;

      // Ensure it contains a 4-digit year or recognizable academic citation pattern
      if (/\b\d{4}\b/.test(inner)) {
        return formatBracketSegment(inner, sources);
      }
      return match;
    },
  );
}
