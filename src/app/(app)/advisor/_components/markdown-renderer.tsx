"use client";

import { useCallback, type MouseEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import type { Components } from "react-markdown";
import type { RagSearchResultItem } from "@/core/services/search/rag-search";
import { CITATION_ATTR, formatContent } from "../_lib/citation-matching";

const components: Components = {
  h1: ({ children, ...props }) => (
    <h1
      className="font-serif text-xl font-semibold tracking-tight text-foreground mt-4 mb-2"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="font-serif text-base font-semibold tracking-tight text-foreground mt-4 mb-2"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="font-serif text-sm font-semibold tracking-tight text-foreground mt-4 mb-2"
      {...props}
    >
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="text-sm leading-relaxed text-card-foreground mb-3" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul
      className="list-disc list-outside pl-5 space-y-2 text-sm text-card-foreground mb-3"
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol
      className="list-decimal list-outside pl-5 space-y-2 text-sm text-card-foreground mb-3"
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li
      className="text-sm leading-relaxed text-card-foreground [&>p]:inline [&>p]:mb-0"
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
    <em className="italic text-foreground font-normal" {...props}>
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
      className="border-l-2 border-primary/30 bg-primary/5 pl-3 py-1 italic text-foreground my-3 rounded-r text-sm"
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
      aria-label="İşaretli onay kutusu"
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const target = e.target as HTMLElement;
      const badge = target.closest(`[${CITATION_ATTR}]`);
      if (badge) {
        e.preventDefault();
        const idx = parseInt(badge.getAttribute(CITATION_ATTR) ?? "-1", 10);
        if (idx >= 0 && onCitationClick) {
          onCitationClick(idx);
        }
      }
    },
    [onCitationClick],
  );

  return (
    <div role="presentation" onClick={handleClick} onKeyDown={handleKeyDown}>
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
