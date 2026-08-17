import type { RagSearchResultItem } from "@/core/services/search/rag-search";

/**
 * Formats a RAG source page reference using Turkish academic APA conventions.
 *
 * @param source - The RAG retrieval result whose page span should be rendered.
 * @returns The page reference string ("Bilinmeyen Sayfa" when no page info exists).
 */
export function formatPageReference(source: RagSearchResultItem): string {
  if (source.printedPageNumber) return `${source.printedPageNumber}.`;
  const pageSpan = source.pageStart;
  const range = source.pageEnd;
  if (pageSpan == null) return "Bilinmeyen Sayfa";
  return pageSpan === range ? `s. ${pageSpan}.` : `ss. ${pageSpan}–${range}.`;
}

/**
 * Builds an explicit in-range note for the audit grounding when a source spans
 * multiple published pages, so any cited page inside the span (e.g. s. 126 in
 * ss. 119-151) is recognized as a valid match instead of a "not found" finding.
 *
 * @param source - The RAG retrieval result.
 * @returns The Turkish range note string, or "" when the source is single-page.
 */
function buildRangeNote(source: RagSearchResultItem): string {
  const printed = source.printedPageNumber;
  if (!printed) return "";
  const match = /(\d{1,4})\s*[-–]\s*(\d{1,4})/.exec(printed);
  if (!match) return "";
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (end - start < 1) return "";
  return ` [Kaynak ${match[1]}-${match[2]} aralığındadır; bu aralıktaki her sayfa (ör. s. ${start + 1}) kaynakla EŞLEŞİR ve geçerlidir]`;
}

/** Options controlling how a RAG source context block is rendered. */
export interface RagSourceContextOptions {
  /** Prepend a caution note when every retrieved source is only a partial/indirect match. */
  includePartialNotice?: boolean;
  /** Append the explicit in-range page validation note used by the strict audit gate. */
  includeRangeNote?: boolean;
}

/**
 * Renders a unified Turkish RAG context block ("--- KAYNAK PARÇASI ---") for a
 * list of retrieved sources, deduplicating repeated paragraphs across blocks.
 *
 * @param sources - The RAG retrieval results to render.
 * @param options - Optional rendering controls.
 * @returns The joined source context block, or "" when no sources are provided.
 */
export function formatRagSourceContext(
  sources: RagSearchResultItem[],
  options: RagSourceContextOptions = {},
): string {
  if (sources.length === 0) return "";

  let context = "";
  if (options.includePartialNotice && sources.every((s) => s.isPartialMatch)) {
    context +=
      "NOT: Aşağıdaki kaynaklar doğrudan eşleşmemektedir, yalnızca dolaylı olarak ilgili olabilirler. Bu bilgileri ihtiyatla kullanın.\n\n";
  }

  const emittedParagraphs = new Set<string>();

  context += sources
    .map((source, idx) => {
      const authors = source.resourceAuthors.join(", ");
      const year = source.resourceYear
        ? `Yıl: ${source.resourceYear}`
        : "Yıl bilinmiyor";
      const pageRef = formatPageReference(source);
      const rangeNote = options.includeRangeNote ? buildRangeNote(source) : "";
      const sectionStr = source.sectionTitle
        ? ` | Bölüm: ${source.sectionTitle}`
        : "";
      const partialTag = source.isPartialMatch ? " [DOLAYLI İLGİLİ]" : "";
      const windowText =
        source.parentContent && source.parentContent.length > 0
          ? source.parentContent
          : source.content;
      const paragraphText = windowText
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph.length > 0)
        .filter((paragraph) => {
          if (emittedParagraphs.has(paragraph)) return false;
          emittedParagraphs.add(paragraph);
          return true;
        })
        .join("\n\n");
      return `--- KAYNAK PARÇASI #${idx + 1}${partialTag} ---
[Eser: "${source.resourceTitle}" | Yazar: ${authors} | ${year} | ${pageRef}${rangeNote}${sectionStr} | Alakalılık Skoru: ${(source.relevanceScore * 100).toFixed(1)}%]
${paragraphText}`;
    })
    .join("\n\n");

  return context;
}
