import type { UnstructuredElement } from "./client";

/** Page markdown output grouped by page number. */
export interface PageMarkdown {
  pageNumber: number;
  text: string;
}

/**
 * Extracts cell texts from a simple HTML table row.
 *
 * @param rowHtml - The HTML of a single <tr> element.
 * @returns Array of cell texts.
 */
function parseHtmlRow(rowHtml: string): string[] {
  const cells: string[] = [];
  const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let match: RegExpExecArray | null;
  while ((match = cellPattern.exec(rowHtml)) !== null) {
    const inner = match[1] ?? "";
    const text = inner
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    cells.push(text);
  }
  return cells;
}

/**
 * Converts an HTML table string into GitHub-flavored Markdown.
 *
 * @param html - The table HTML from element metadata.text_as_html.
 * @returns A Markdown table string, or empty when no rows are parseable.
 */
export function htmlTableToMarkdown(html: string): string {
  const rowMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  const rows = rowMatches.map(parseHtmlRow).filter((cells) => cells.length > 0);
  if (rows.length === 0) return "";

  const columnCount = Math.max(...rows.map((cells) => cells.length));
  const lines: string[] = [];
  let headerWritten = false;

  for (const cells of rows) {
    const padded = cells.concat(
      Array(Math.max(0, columnCount - cells.length)).fill(""),
    );
    const rowLine = `| ${padded.join(" | ")} |`;
    lines.push(rowLine);
    if (!headerWritten) {
      lines.push(`| ${Array(columnCount).fill("---").join(" | ")} |`);
      headerWritten = true;
    }
  }

  return lines.join("\n");
}

/**
 * Renders a single Unstructured element into Markdown text.
 *
 * @param element - The Unstructured element to render.
 * @returns The Markdown representation, or empty string when skipped.
 */
function elementToMarkdown(element: UnstructuredElement): string {
  const type = element.type ?? "";
  const text = (element.text ?? "").trim();
  const textAsHtml = element.metadata?.text_as_html;

  switch (type) {
    case "Title":
      return text ? `# ${text}` : "";
    case "Header":
      return text ? `## ${text}` : "";
    case "Subtitle":
      return text ? `### ${text}` : "";
    case "ListItem":
      return text ? `- ${text}` : "";
    case "Table": {
      if (textAsHtml) {
        const table = htmlTableToMarkdown(textAsHtml);
        if (table) return table;
      }
      return text;
    }
    case "Footer":
    case "PageNumber":
    case "PageBreak":
    case "Image":
      return "";
    default:
      return text;
  }
}

/**
 * Converts an Unstructured element array into per-page Markdown, grouping elements by page_number.
 *
 * @param elements - Raw elements returned by the Transform partitioner.
 * @returns Array of page markdown objects, ordered by page number.
 */
export function elementsToPageMarkdown(
  elements: UnstructuredElement[],
): PageMarkdown[] {
  const pages = new Map<number, string[]>();

  for (const element of elements) {
    const pageNumber = element.metadata?.page_number ?? 1;
    const markdown = elementToMarkdown(element);
    if (!markdown) continue;
    const lines = pages.get(pageNumber);
    if (lines) {
      lines.push(markdown);
    } else {
      pages.set(pageNumber, [markdown]);
    }
  }

  const sortedKeys = [...pages.keys()].sort((a, b) => a - b);
  return sortedKeys
    .map((pageNumber) => ({
      pageNumber,
      text: (pages.get(pageNumber) ?? []).join("\n\n").trim(),
    }))
    .filter((page) => page.text.length > 0);
}
