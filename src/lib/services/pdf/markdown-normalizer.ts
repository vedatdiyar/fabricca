import type { NormalizedMarkdown } from "./types";

const PROTECTED_BLOCK_PATTERNS: RegExp[] = [
  /^```[\s\S]*?^```/gm,
  /^\$\$[\s\S]*?^\$\$/gm,
  /\$[^$\n]+\$/g,
  /^\|.+\|.*$/gm,
  /!\[.*?\]\(.*?\)/g,
  /\[\^\d+\](?::\s*.+)?/g,
  /\[\d+\]\([^)]*\)/g,
];

/**
 * Splits Markdown into protected regions and plain text segments so normalization targets only plain text.
 *
 * @param markdown - Markdown text to segment.
 * @returns Alternating plain and protected text segments.
 */
function segmentMarkdown(
  markdown: string,
): Array<{ text: string; isProtected: boolean }> {
  const protectedRanges: Array<{ start: number; end: number }> = [];

  for (const pattern of PROTECTED_BLOCK_PATTERNS) {
    const re = new RegExp(
      pattern.source,
      pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g",
    );
    let match: RegExpExecArray | null;
    while ((match = re.exec(markdown)) !== null) {
      protectedRanges.push({
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  protectedRanges.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of protectedRanges) {
    if (merged.length > 0 && range.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(
        merged[merged.length - 1].end,
        range.end,
      );
    } else {
      merged.push({ ...range });
    }
  }

  const segments: Array<{ text: string; isProtected: boolean }> = [];
  let lastEnd = 0;

  for (const range of merged) {
    if (range.start > lastEnd) {
      segments.push({
        text: markdown.slice(lastEnd, range.start),
        isProtected: false,
      });
    }
    segments.push({
      text: markdown.slice(range.start, range.end),
      isProtected: true,
    });
    lastEnd = range.end;
  }

  if (lastEnd < markdown.length) {
    segments.push({ text: markdown.slice(lastEnd), isProtected: false });
  }

  return segments;
}

/**
 * Normalizes heading hierarchy academically by re-mapping levels to a sequential order starting from a single hash.
 *
 * @param text - Plain text segment to normalize.
 * @returns Normalized text and the number of heading fixes applied.
 */
function normalizeHeadings(text: string): { fixed: string; count: number } {
  let count = 0;

  const headingLevels = new Set<number>();
  const headingRe = /^(#{1,6})\s+/gm;
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(text)) !== null) {
    headingLevels.add(m[1].length);
  }

  if (headingLevels.size === 0) {
    const fixed = text.replace(/^(.{3,80})$/gm, (line) => {
      const trimmed = line.trim();
      if (trimmed.length < 3 || trimmed.length > 80) return line;
      const letters = [...trimmed].filter((c) => /\p{L}/u.test(c));
      if (letters.length < 3) return line;
      const hasLowercase = letters.some((c) => /\p{Ll}/u.test(c));
      if (hasLowercase) return line;
      if (/^\d/.test(trimmed)) return line;
      count++;
      return `## ${trimmed}`;
    });
    return { fixed, count };
  }

  const sortedLevels = [...headingLevels].sort((a, b) => a - b);
  const levelMap = new Map<number, number>();
  sortedLevels.forEach((level, idx) => {
    levelMap.set(level, Math.min(idx + 1, 4));
  });

  const fixed = text.replace(
    /^(#{1,6})(\s+.+)$/gm,
    (_, hashes: string, rest: string) => {
      const originalLevel = hashes.length;
      const newLevel = levelMap.get(originalLevel) ?? originalLevel;
      if (newLevel !== originalLevel) {
        count++;
        return "#".repeat(newLevel) + rest;
      }
      return hashes + rest;
    },
  );

  return { fixed, count };
}

/**
 * Converts bullet-style list symbols to standard Markdown dash markers.
 *
 * @param text - Plain text segment to normalize.
 * @returns Normalized text and the number of list symbol fixes applied.
 */
function normalizeLists(text: string): { fixed: string; count: number } {
  let count = 0;
  const fixed = text.replace(
    /^(\s*)[•·–\*](\s+)/gm,
    (_, indent: string, space: string) => {
      count++;
      return `${indent}-${space}`;
    },
  );
  return { fixed, count };
}

/**
 * Converts inline superscript Unicode footnote markers to bracketed footnote notation.
 *
 * @param text - Plain text segment to normalize.
 * @returns Normalized text and the number of footnote conversions applied.
 */
function normalizeFootnotes(text: string): { fixed: string; count: number } {
  let count = 0;

  const superMap: Record<string, string> = {
    "\u00B9": "1",
    "\u00B2": "2",
    "\u00B3": "3",
    "\u2074": "4",
    "\u2075": "5",
    "\u2076": "6",
    "\u2077": "7",
    "\u2078": "8",
    "\u2079": "9",
  };

  const fixed = text.replace(/([¹²³⁴⁵⁶⁷⁸⁹])/gu, (_, sup: string) => {
    const n = superMap[sup];
    if (!n) return _;
    count++;
    return `[^${n}]`;
  });

  return { fixed, count };
}

/**
 * Applies final style normalization to stitched Markdown while protecting code blocks, math, tables, and images.
 *
 * @param markdown - Stitched Markdown to normalize.
 * @returns Normalized Markdown with normalization statistics.
 */
export function normalizeMarkdownStyle(markdown: string): NormalizedMarkdown {
  if (!markdown.trim()) {
    return {
      markdown: "",
      normalizationsApplied: {
        headingLevelFixes: 0,
        listSymbolFixes: 0,
        footnoteConversions: 0,
      },
    };
  }

  const segments = segmentMarkdown(markdown);

  let headingLevelFixes = 0;
  let listSymbolFixes = 0;
  let footnoteConversions = 0;

  const processedSegments = segments.map((seg) => {
    if (seg.isProtected) return seg.text;

    const h = normalizeHeadings(seg.text);
    const l = normalizeLists(h.fixed);
    const f = normalizeFootnotes(l.fixed);

    headingLevelFixes += h.count;
    listSymbolFixes += l.count;
    footnoteConversions += f.count;

    return f.fixed;
  });

  return {
    markdown: processedSegments.join(""),
    normalizationsApplied: {
      headingLevelFixes,
      listSymbolFixes,
      footnoteConversions,
    },
  };
}
