import type { RagSearchResultItem } from "@/services/search/rag-search";

/** Tailwind classes for clickable citation badges. */
export const CITATION_BADGE_CLASS =
  "inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-1 text-xs font-medium cursor-pointer hover:bg-primary/20 transition-colors select-none";

export const CITATION_ATTR = "data-source-index";

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
 * Matches a citation author string against a source's author list by last name.
 *
 * @param citationAuthor - The author name from the citation text.
 * @param sourceAuthors - The source's resourceAuthors array.
 * @returns True if the last names match.
 */
function matchesAuthor(
  citationAuthor: string,
  sourceAuthors: string[],
): boolean {
  const citationLast = extractLastName(citationAuthor).toLowerCase();
  return sourceAuthors.some(
    (a) => extractLastName(a).toLowerCase() === citationLast,
  );
}

/**
 * Replaces inline citations with clickable HTML badge spans.
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

  return sanitizedContent.replace(
    /([\[\(])([A-Za-zÇçĞğİıÖöŞşÜü\s.]+?),\s*(\d{4})(?:,\s*((?:s\.|ss\.)\s*[\d\s,–-]+))?([\]\)])/g,
    (
      match,
      _openDelim: string,
      authorStr: string,
      year: string,
      pageRef: string | undefined,
    ) => {
      const pagePart = pageRef ? `, ${pageRef}` : "";
      const badgeLabel = `(${authorStr}, ${year}${pagePart})`;

      const citedPages: number[] = [];
      if (pageRef) {
        const pageNums = pageRef.match(/\d+/g);
        if (pageNums) {
          citedPages.push(...pageNums.map((n) => parseInt(n, 10)));
        }
      }
      const citedYear = parseInt(year, 10);

      let bestIdx = -1;
      let maxScore = -1;

      for (let i = 0; i < sources.length; i++) {
        const source = sources[i];
        let score = 0;

        if (!matchesAuthor(authorStr, source.resourceAuthors)) {
          continue;
        }
        score += 10;

        if (source.resourceYear === citedYear) {
          score += 10;
        }

        if (citedPages.length > 0) {
          const sStart = source.pageStart;
          const sEnd = source.pageEnd;

          if (sStart != null && sEnd != null) {
            const citedStart = citedPages[0];
            const citedEnd = citedPages[citedPages.length - 1];

            if (citedStart === sStart && citedEnd === sEnd) {
              score += 100;
            } else if (citedStart >= sStart && citedEnd <= sEnd) {
              score += 80;
            } else if (citedStart <= sEnd && citedEnd >= sStart) {
              score += 50;
            }
          } else if (source.printedPageNumber) {
            const printedStr = source.printedPageNumber;
            if (citedPages.some((p) => printedStr.includes(String(p)))) {
              score += 40;
            }
          }
        }

        if (score > maxScore) {
          maxScore = score;
          bestIdx = i;
        }
      }

      if (bestIdx === -1) {
        return `<span class="${CITATION_BADGE_CLASS}" role="button" tabindex="0" aria-label="${badgeLabel}">${badgeLabel}</span>`;
      }
      return `<span class="${CITATION_BADGE_CLASS}" role="button" tabindex="0" aria-label="${badgeLabel}" ${CITATION_ATTR}="${bestIdx}">${badgeLabel}</span>`;
    },
  );
}
