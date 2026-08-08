"use client";

import { useCallback, type MouseEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import type { Components } from "react-markdown";
import type { RagSearchResultItem } from "@/lib/services/rag-search";

/** Tailwind classes for clickable citation badges. */
const CITATION_BADGE_CLASS =
  "inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-1 text-xs font-medium cursor-pointer hover:bg-primary/20 transition-colors select-none";

const CITATION_ATTR = "data-source-index";

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
function formatContent(
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
        return `<span class="${CITATION_BADGE_CLASS}">${badgeLabel}</span>`;
      }
      return `<span class="${CITATION_BADGE_CLASS}" ${CITATION_ATTR}="${bestIdx}">${badgeLabel}</span>`;
    },
  );
}

const components: Components = {
  h1: ({ children, ...props }) => (
    <h1
      className="font-serif text-[17px] font-medium text-foreground mt-5 mb-2.5"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="font-serif text-base font-medium text-foreground mt-4 mb-2"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="font-serif text-[15px] font-medium text-foreground mt-3 mb-1.5"
      {...props}
    >
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p
      className="text-[15px] leading-relaxed text-card-foreground font-light mb-3"
      {...props}
    >
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul
      className="list-disc list-outside pl-5 space-y-2 text-[15px] text-card-foreground font-light mb-3"
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol
      className="list-decimal list-outside pl-5 space-y-2 text-[15px] text-card-foreground font-light mb-3"
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li
      className="text-[15px] leading-relaxed text-card-foreground font-light [&>p]:inline [&>p]:mb-0"
      {...props}
    >
      {children}
    </li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-medium text-foreground" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic text-muted-foreground" {...props}>
      {children}
    </em>
  ),
  del: ({ children, ...props }) => (
    <del className="line-through text-muted-foreground" {...props}>
      {children}
    </del>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <pre className="bg-muted/20 border border-border/40 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre my-2">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      );
    }
    return (
      <code
        className="bg-muted px-2 py-1 rounded text-xs font-mono text-primary"
        {...props}
      >
        {children}
      </code>
    );
  },
  a: ({ href, children, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 transition-colors"
      {...props}
    >
      {children}
    </a>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="border-l-2 border-primary/20 pl-3 italic text-muted-foreground my-3"
      {...props}
    >
      {children}
    </blockquote>
  ),
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-xs border-collapse" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-muted/20" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th className="font-medium text-left p-2 border border-border" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="p-2 border border-border" {...props}>
      {children}
    </td>
  ),
  hr: (props) => <hr className="my-3 border-border/40" {...props} />,
  input: (props) => (
    <input
      type="checkbox"
      checked={props.checked}
      readOnly
      className="mr-1 accent-primary"
    />
  ),
};

interface MarkdownRendererProps {
  content: string;
  sources?: RagSearchResultItem[];
  onCitationClick?: (sourceIndex: number) => void;
}

/**
 * Renders markdown content as styled React elements with clickable citation badges.
 *
 * @param root0 - Component props.
 * @param root0.content - Markdown string to render.
 * @param root0.sources - RAG source items for citation matching.
 * @param root0.onCitationClick - Callback when a citation badge is clicked.
 * @returns The rendered markdown output.
 */
export function MarkdownRenderer({
  content,
  sources = [],
  onCitationClick,
}: MarkdownRendererProps) {
  const handleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const badge = target.closest(`[${CITATION_ATTR}]`);
      if (badge) {
        const idx = parseInt(badge.getAttribute(CITATION_ATTR) ?? "-1", 10);
        if (idx >= 0 && onCitationClick) {
          onCitationClick(idx);
        }
      }
    },
    [onCitationClick],
  );

  return (
    <div onClick={handleClick}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {formatContent(content, sources)}
      </ReactMarkdown>
    </div>
  );
}
