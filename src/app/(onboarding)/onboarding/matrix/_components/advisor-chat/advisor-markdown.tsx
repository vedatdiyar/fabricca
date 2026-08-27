"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Client-side safety sanitizer to ensure no internal <matrix_update> machine tags leak into UI.
 *
 * @param text - Raw message text to sanitize.
 * @returns Clean, human-readable text.
 */
export function cleanAdvisorMessageText(text: string): string {
  if (!text) return "";
  return text
    .replace(
      /```(?:xml|json)?\s*<matrix[_-]update\b[^>]*>[\s\S]*?(?:<\/matrix[_-]update>\s*```|```|$)/gi,
      "",
    )
    .replace(
      /<matrix[_-]update\b[^>]*>[\s\S]*?(?:<\/matrix[_-]update>|$)/gi,
      "",
    )
    .replace(/```(?:xml|json)?\s*```/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface AdvisorMarkdownProps {
  content: string;
}

/**
 * Styled Markdown renderer for Advisor Socratic responses and live SSE text deltas.
 *
 * @param props - Markdown content props.
 * @returns Formatted academic Markdown elements.
 */
export const AdvisorMarkdown = memo(function AdvisorMarkdown({
  content,
}: AdvisorMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="font-serif text-xl font-semibold tracking-tight text-foreground mt-3 first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="font-serif text-base font-semibold tracking-tight text-foreground mt-2.5 first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground mt-2 first:mt-0">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="text-sm font-normal leading-relaxed text-foreground">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-4 space-y-1 my-1.5 text-sm font-normal text-foreground">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-4 space-y-1 my-1.5 text-sm font-normal text-foreground">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="text-sm leading-relaxed text-foreground">
            {children}
          </li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary/60 bg-primary/5 py-2 px-3.5 my-2.5 rounded-r-md text-foreground">
            {children}
          </blockquote>
        ),
        code: ({ children }) => (
          <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-background border border-border text-foreground">
            {children}
          </code>
        ),
      }}
    >
      {cleanAdvisorMessageText(content)}
    </ReactMarkdown>
  );
});
