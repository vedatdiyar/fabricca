import React from "react";
import { QuotationRow } from "../types";

export function cleanPageNumber(pageStr: string): string {
  return pageStr
    .trim()
    .replace(/^(?:sayfa|Sayfa|s\.|s)\s*/i, "")
    .trim();
}

// Parse quotes from database string to array of QuotationRow
export function parseQuotes(
  quotesStr: string | null | undefined,
): QuotationRow[] {
  if (!quotesStr || !quotesStr.trim()) {
    return [{ text: "", page: "" }];
  }

  const rows: QuotationRow[] = [];
  const lines = quotesStr.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Matches bullet points of type: - s. 45: "some quote text"
    // Or: s. 45: "some quote text"
    // Or: - s. 45: some quote text
    const match =
      trimmed.match(/^(?:-\s*)?s\.\s*([^:]+):\s*"([\s\S]*)"$/) ||
      trimmed.match(/^(?:-\s*)?s\.\s*([^:]+):\s*([\s\S]*)$/);

    if (match) {
      rows.push({
        page: cleanPageNumber(match[1]),
        text: match[2].trim(),
      });
    } else {
      // Fallback for simple list items or plain text that doesn't have page
      const textOnly = trimmed.replace(/^-\s*/, "");
      rows.push({
        page: "",
        text: textOnly,
      });
    }
  }

  return rows.length > 0 ? rows : [{ text: "", page: "" }];
}

export const inlineMarkdownComponents = {
  h1: ({ children }: React.ComponentPropsWithoutRef<"h1">) => (
    <span className="block font-bold text-primary text-[10px] uppercase tracking-wider mt-2.5 mb-0.5 font-sans">
      {children}
    </span>
  ),
  h2: ({ children }: React.ComponentPropsWithoutRef<"h2">) => (
    <span className="block font-bold text-primary text-[10px] uppercase tracking-wider mt-2 mb-0.5 font-sans">
      {children}
    </span>
  ),
  h3: ({ children }: React.ComponentPropsWithoutRef<"h3">) => (
    <span className="block font-bold text-primary text-[10px] uppercase tracking-wider mt-1.5 mb-0.5 font-sans">
      {children}
    </span>
  ),
  h4: ({ children }: React.ComponentPropsWithoutRef<"h4">) => (
    <span className="block font-bold text-primary text-[10px] uppercase tracking-wider mt-1.5 mb-0.5 font-sans">
      {children}
    </span>
  ),
  p: ({ children }: React.ComponentPropsWithoutRef<"p">) => (
    <span className="block font-sans text-foreground leading-relaxed mb-1.5 last:mb-0">
      {children}
    </span>
  ),
};
