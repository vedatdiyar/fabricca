import type { PageMarkdown, StitchedMarkdown } from "./types";

/** Minimum share of pages a line must appear on to count as a repeating header/footer. */
const HEADER_FOOTER_REPEAT_RATIO = 0.5;
/** How many leading/trailing lines are inspected per page. */
const HEADER_FOOTER_LINE_CHECK = 2;

const TABLE_ROW_RE = /^\|.+\|/;
const IMAGE_TAG_RE = /!\[.*?\]\(.*?\)/;
const MATH_BLOCK_RE = /^\$\$/;
const CODE_FENCE_RE = /^```/;

/**
 * Whether a line must be skipped during hyphen or paragraph repair.
 *
 * @param line - Text line to evaluate.
 * @returns True if the line is a table, image, math block, or code fence.
 */
function isProtectedLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    TABLE_ROW_RE.test(trimmed) ||
    IMAGE_TAG_RE.test(trimmed) ||
    MATH_BLOCK_RE.test(trimmed) ||
    CODE_FENCE_RE.test(trimmed)
  );
}

/**
 * Detects repeating header and footer lines across the first and last lines of every page.
 *
 * @param pages - Per-page markdown to inspect.
 * @returns Normalized lines appearing frequently enough to be headers or footers.
 */
function detectRepeatingHeaderFooters(pages: PageMarkdown[]): Set<string> {
  if (pages.length < 3) return new Set();

  const lineFrequency = new Map<string, number>();
  const minRepeatCount = Math.ceil(pages.length * HEADER_FOOTER_REPEAT_RATIO);

  for (const page of pages) {
    if (!page.markdown.trim()) continue;
    const lines = page.markdown.split("\n").filter((l) => l.trim().length > 0);

    const candidateLines = [
      ...lines.slice(0, HEADER_FOOTER_LINE_CHECK),
      ...lines.slice(-HEADER_FOOTER_LINE_CHECK),
    ];

    const seenThisPage = new Set<string>();
    for (const line of candidateLines) {
      const normalized = line.trim().toLowerCase();
      if (!normalized || seenThisPage.has(normalized)) continue;
      seenThisPage.add(normalized);
      lineFrequency.set(normalized, (lineFrequency.get(normalized) ?? 0) + 1);
    }
  }

  const repeating = new Set<string>();

  for (const [line, count] of lineFrequency) {
    if (count >= minRepeatCount) {
      repeating.add(line);
    }
  }

  return repeating;
}

/**
 * Whether a line matches a common page-number pattern.
 *
 * @param line - Text line to evaluate.
 * @returns True if the line looks like a page number.
 */
function isPageNumberLine(line: string): boolean {
  const t = line.trim();
  return (
    /^\d+$/.test(t) ||
    /^[-–—]\s*\d+\s*[-–—]$/.test(t) ||
    /^Sayfa\s+\d+$/i.test(t) ||
    /^Page\s+\d+$/i.test(t)
  );
}

/**
 * Joins a paragraph broken across pages when the previous page ends mid-sentence and the next page starts with a lowercase letter.
 *
 * @param prev - End of the previous page markdown.
 * @param next - Start of the next page markdown.
 * @returns True if the paragraph should be joined.
 */
function tryJoinParagraph(prev: string, next: string): boolean {
  if (!prev.trim() || !next.trim()) return false;

  const prevLines = prev.split("\n");
  const lastLine = prevLines[prevLines.length - 1].trim();
  const nextLines = next.split("\n");
  const firstLine = nextLines[0].trim();

  if (isProtectedLine(lastLine) || isProtectedLine(firstLine)) return false;

  const endsWithSentence = /[.!?…」』)}\]"'"']$/.test(lastLine);
  const startsWithLower =
    firstLine.length > 0 &&
    firstLine[0] === firstLine[0].toLowerCase() &&
    /\p{Ll}/u.test(firstLine[0]);

  return !endsWithSentence && startsWithLower;
}

/**
 * Merges hyphenation across line breaks.
 *
 * @param markdown - Markdown text to repair.
 * @returns Fixed markdown and the number of hyphen repairs applied.
 */
function repairHyphenation(markdown: string): { fixed: string; count: number } {
  let count = 0;
  const fixed = markdown.replace(
    /(\p{L})-\s*\n\s*(\p{Ll})/gu,
    (_, pre: string, post: string) => {
      count++;
      return pre + post;
    },
  );
  return { fixed, count };
}

/**
 * Merges per-page Markdown, removing repeating headers and footers, repairing page-break paragraphs and hyphenation while preserving tables, images, math, and code blocks.
 *
 * @param pages - Per-page markdown from different engines.
 * @returns Stitched full markdown with repair statistics.
 */
export function stitchPageMarkdowns(pages: PageMarkdown[]): StitchedMarkdown {
  if (pages.length === 0) {
    return {
      fullMarkdown: "",
      repairsApplied: {
        paragraphJoins: 0,
        hyphenRepairs: 0,
        headerFooterRemovals: 0,
      },
    };
  }

  const repeatingLines = detectRepeatingHeaderFooters(pages);
  let headerFooterRemovals = 0;

  /**
   * Removes repeating header and footer lines plus page numbers from one page.
   *
   * @param markdown - Page markdown to clean.
   * @returns Page markdown without header, footer, or page-number lines.
   */
  function cleanHeaderFooter(markdown: string): string {
    const lines = markdown.split("\n");
    const cleaned: string[] = [];

    for (const line of lines) {
      const normalized = line.trim().toLowerCase();
      if (repeatingLines.has(normalized) || isPageNumberLine(line)) {
        headerFooterRemovals++;
        continue;
      }
      cleaned.push(line);
    }

    return cleaned.join("\n");
  }

  const cleanedPages = pages.map((page) => ({
    ...page,
    markdown: cleanHeaderFooter(page.markdown),
  }));

  let paragraphJoins = 0;
  const parts: string[] = [];

  for (let i = 0; i < cleanedPages.length; i++) {
    const current = cleanedPages[i].markdown.trim();
    if (!current) continue;

    if (parts.length === 0) {
      parts.push(current);
      continue;
    }

    const prev = parts[parts.length - 1];
    const shouldJoin = tryJoinParagraph(prev, current);

    if (shouldJoin) {
      const prevLines = prev.split("\n");
      const currLines = current.split("\n");
      const stitched =
        prevLines.slice(0, -1).join("\n") +
        "\n" +
        prevLines[prevLines.length - 1].trim() +
        " " +
        currLines[0].trim() +
        (currLines.length > 1 ? "\n" + currLines.slice(1).join("\n") : "");
      parts[parts.length - 1] = stitched;
      paragraphJoins++;
    } else {
      parts.push(current);
    }
  }

  const joined = parts.join("\n\n");
  const { fixed: repairedMarkdown, count: hyphenRepairs } =
    repairHyphenation(joined);

  return {
    fullMarkdown: repairedMarkdown,
    repairsApplied: {
      paragraphJoins,
      hyphenRepairs,
      headerFooterRemovals,
    },
  };
}
