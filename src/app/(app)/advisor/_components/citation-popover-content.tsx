import { FileText } from "lucide-react";
import type { CitationPopoverContentProps } from "./types";

/**
 * Renders the academic source details as an inline citation panel.
 *
 * @param root0 - Component props.
 * @param root0.source - The RAG source item to display.
 * @returns Citation popup card element.
 */
export function CitationPopoverContent({
  source,
}: CitationPopoverContentProps) {
  const pageSpan = source.pageStart ?? null;
  const pageEnd = source.pageEnd ?? pageSpan;
  const pageRef =
    source.printedPageNumber ??
    (pageSpan != null && pageEnd != null
      ? pageSpan === pageEnd
        ? `s. ${pageSpan}`
        : `ss. ${pageSpan}–${pageEnd}`
      : null);

  return (
    <div className="text-sm space-y-4">
      <div className="flex items-center justify-between gap-2 mt-4">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="size-4 text-primary shrink-0" />
          <span className="font-medium text-foreground break-words">
            {source.resourceTitle}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-[11px] shrink-0">
            %{(source.relevanceScore * 100).toFixed(0)} Alaka
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{source.resourceAuthors.join(", ")}</span>
        {pageRef && <span>{pageRef}</span>}
        {source.sectionTitle && (
          <span className="truncate">Bölüm: {source.sectionTitle}</span>
        )}
      </div>

      <div className="text-sm text-foreground leading-relaxed space-y-3 pl-3 border-l-2 border-primary/20">
        {source.content.split("\n\n").map((paragraph, i) => {
          const lines = paragraph.split("\n");
          const hasNumberedItems = lines.some((l) =>
            /^\d+[.)]\s/.test(l.trim()),
          );
          if (hasNumberedItems) {
            return (
              <ol key={i} className="list-decimal list-inside space-y-1">
                {lines.map((line, j) => (
                  <li key={j}>{line.trim().replace(/^\d+[.)]\s*/, "")}</li>
                ))}
              </ol>
            );
          }
          return <p key={i}>{paragraph}</p>;
        })}
      </div>
    </div>
  );
}
