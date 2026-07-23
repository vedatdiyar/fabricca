import React from "react";

interface PositioningMarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Parses inline markdown elements (bold, italic, inline code) into React nodes.
 *
 * @param text - Raw markdown text segment.
 * @returns Array of formatted React elements or plain text strings.
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={idx} className="italic text-foreground/90">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={idx}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-primary"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/**
 * Custom lightweight Markdown renderer for academic positioning gap reports.
 * Formats headings, bullet lists, numbered lists, blockquotes, and paragraphs
 * without requiring external npm dependencies.
 */
export function PositioningMarkdownRenderer({
  content,
  className = "",
}: PositioningMarkdownRendererProps) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  let inBulletList = false;
  let bulletItems: React.ReactNode[] = [];

  const flushBulletList = () => {
    if (inBulletList && bulletItems.length > 0) {
      elements.push(
        <ul
          key={`bullet-list-${elements.length}`}
          className="my-3 space-y-2 pl-5 list-disc text-sm leading-relaxed text-foreground/90"
        >
          {bulletItems}
        </ul>,
      );
      bulletItems = [];
      inBulletList = false;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushBulletList();
      return;
    }

    // Headings
    if (trimmed.startsWith("# ")) {
      flushBulletList();
      elements.push(
        <h1
          key={idx}
          className="mt-6 mb-3 font-serif text-xl font-bold tracking-tight text-foreground border-b border-border pb-2"
        >
          {parseInlineMarkdown(trimmed.slice(2))}
        </h1>,
      );
      return;
    }

    if (trimmed.startsWith("## ")) {
      flushBulletList();
      elements.push(
        <h2
          key={idx}
          className="mt-5 mb-2.5 font-serif text-lg font-semibold tracking-tight text-foreground"
        >
          {parseInlineMarkdown(trimmed.slice(3))}
        </h2>,
      );
      return;
    }

    if (trimmed.startsWith("### ")) {
      flushBulletList();
      elements.push(
        <h3
          key={idx}
          className="mt-4 mb-2 font-serif text-base font-semibold text-foreground/95"
        >
          {parseInlineMarkdown(trimmed.slice(4))}
        </h3>,
      );
      return;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      flushBulletList();
      elements.push(
        <blockquote
          key={idx}
          className="my-3 border-l-4 border-primary/50 bg-primary/5 px-4 py-2.5 rounded-r text-sm text-foreground/90 italic"
        >
          {parseInlineMarkdown(trimmed.slice(2))}
        </blockquote>,
      );
      return;
    }

    // Bullet List
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      inBulletList = true;
      bulletItems.push(
        <li key={idx} className="marker:text-primary">
          {parseInlineMarkdown(trimmed.slice(2))}
        </li>,
      );
      return;
    }

    // Numbered list item
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      flushBulletList();
      elements.push(
        <div
          key={idx}
          className="my-2 flex items-start gap-2 text-sm leading-relaxed"
        >
          <span className="font-semibold text-primary min-w-[20px]">
            {numberedMatch[1]}.
          </span>
          <span className="text-foreground/90">
            {parseInlineMarkdown(numberedMatch[2])}
          </span>
        </div>,
      );
      return;
    }

    // Standard Paragraph
    flushBulletList();
    elements.push(
      <p key={idx} className="my-2 text-sm leading-relaxed text-foreground/90">
        {parseInlineMarkdown(trimmed)}
      </p>,
    );
  });

  flushBulletList();

  return <div className={`space-y-1 ${className}`}>{elements}</div>;
}
