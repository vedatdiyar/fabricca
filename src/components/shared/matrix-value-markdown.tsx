"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const matrixComponents: Components = {
  p: ({ children }) => (
    <p className="text-sm font-normal leading-relaxed font-sans text-foreground mb-2 last:mb-0">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-foreground">{children}</em>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 space-y-1 my-2 text-sm font-normal text-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 space-y-1 my-2 text-sm font-normal text-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-sm leading-relaxed text-foreground">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/30 bg-primary/5 py-1.5 px-3 my-2 rounded-r-md text-sm text-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted border border-border text-foreground">
      {children}
    </code>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
};

interface MatrixValueMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Lightweight academic markdown renderer for thesis matrix values.
 * Handles bold/italic/lists produced by the LLM matrix synthesis.
 *
 * @param root0 - Component props.
 * @param root0.content - Raw matrix field string (may contain **, *, lists).
 * @param root0.className - Optional wrapper class.
 */
export const MatrixValueMarkdown = memo(function MatrixValueMarkdown({
  content,
  className,
}: MatrixValueMarkdownProps) {
  if (!content?.trim()) return null;

  return (
    <div className={className ?? "space-y-1"}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={matrixComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
