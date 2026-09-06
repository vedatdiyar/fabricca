import type { RagSearchResultItem } from "@/core/services/search/rag-search";

/**
 * Formats a RAG source page reference using Turkish academic APA conventions.
 *
 * @param source - The RAG retrieval result whose page span should be rendered.
 * @returns The page reference string ("Bilinmeyen Sayfa" when no page info exists).
 */
export function formatPageReference(source: RagSearchResultItem): string {
  if (source.pageNumber) return `${source.pageNumber}.`;
  return "Bilinmeyen Sayfa";
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
  const printed = source.pageNumber;
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
 * Renders a single RAG source block, registering emitted paragraphs for dedup.
 *
 * @param source - The RAG retrieval result to render.
 * @param displayIndex - 1-based global ordinal used in the "KAYNAK PARÇASI" tag.
 * @param emittedParagraphs - Shared set of already-rendered paragraphs.
 * @param includeRangeNote - Whether to append the audit in-range page note.
 * @returns The rendered source block.
 */
function renderRagSourceBlock(
  source: RagSearchResultItem,
  displayIndex: number,
  emittedParagraphs: Set<string>,
  includeRangeNote: boolean,
): string {
  const authors = source.resourceAuthors.join(", ");
  const year = source.resourceYear
    ? `Yıl: ${source.resourceYear}`
    : "Yıl bilinmiyor";
  const pageRef = formatPageReference(source);
  const rangeNote = includeRangeNote ? buildRangeNote(source) : "";
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
  const typeTag = source.isPrimaryMaterial
    ? "TÜR: BİRİNCİL ARAŞTIRMA VERİSİ / AMPİRİK KANIT"
    : "TÜR: AKADEMİK LİTERATÜR";
  return `--- KAYNAK PARÇASI #${displayIndex}${partialTag} [${typeTag}] ---
[${source.isPrimaryMaterial ? "Belge/Materyal" : "Eser"}: "${source.resourceTitle}" | ${source.isPrimaryMaterial ? "Orijin/Kaynak/Yazar" : "Yazar"}: ${authors} | ${year} | ${pageRef}${rangeNote}${sectionStr} | Alakalılık Skoru: ${(source.relevanceScore * 100).toFixed(1)}%]
${paragraphText}`;
}

/**
 * Renders bimodal Turkish RAG context grouped under two explicit headings:
 * primary empirical material first, then academic/theoretical literature.
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
  const includeRangeNote = options.includeRangeNote ?? false;
  const primary = sources.filter((s) => s.isPrimaryMaterial);
  const secondary = sources.filter((s) => !s.isPrimaryMaterial);
  let displayIndex = 0;
  const renderGroup = (group: RagSearchResultItem[]): string =>
    group
      .map((source) => {
        displayIndex += 1;
        return renderRagSourceBlock(
          source,
          displayIndex,
          emittedParagraphs,
          includeRangeNote,
        );
      })
      .join("\n\n");

  const sections: string[] = [];
  if (primary.length > 0) {
    sections.push(
      `### BİRİNCİL ARAŞTIRMA VERİLERİ (SAHA / ARŞİV KORPUSU / AMPİRİK KANITLAR):\n${renderGroup(primary)}`,
    );
  }
  if (secondary.length > 0) {
    sections.push(
      `### AKADEMİK LİTERATÜR VE KURAMSAL ÇERÇEVE:\n${renderGroup(secondary)}`,
    );
  }

  context += sections.join("\n\n");

  return context;
}
