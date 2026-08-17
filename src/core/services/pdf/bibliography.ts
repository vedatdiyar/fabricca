import type { DocumentAnalysisResult } from "./schema";

/**
 * Number of bibliography pages grouped into a single Gemini reference-extraction call.
 * Batching 4 pages per call was benchmarked as the fastest reliable configuration.
 */
export const REFERENCES_BATCH_SIZE = 4 as const;

/**
 * Groups bibliography pages into fixed-size batches and joins each batch into a
 * single page-marked text block, so each group shares one Gemini reference call
 * instead of firing a request per page.
 *
 * @param pages - Bibliography pages to process.
 * @param toPageText - Converts one page into its page-marked text block.
 * @param batchSize - Pages per batch (defaults to REFERENCES_BATCH_SIZE).
 * @returns Combined batch texts, one per reference-extraction call.
 */
export function buildReferenceBatches<T>(
  pages: T[],
  toPageText: (page: T) => string,
  batchSize = REFERENCES_BATCH_SIZE,
): string[] {
  const batches: string[] = [];
  for (let i = 0; i < pages.length; i += batchSize) {
    batches.push(
      pages
        .slice(i, i + batchSize)
        .map(toPageText)
        .join("\n\n"),
    );
  }
  return batches;
}

/**
 * Flattens per-batch reference results and removes duplicates keyed by raw text.
 *
 * @param results - Reference arrays returned by each batch extraction call.
 * @returns Unique references preserving first-seen order.
 */
export function dedupeReferences(
  results: DocumentAnalysisResult["references"][],
): DocumentAnalysisResult["references"] {
  const merged = results.flat();
  const refMap = new Map<
    string,
    DocumentAnalysisResult["references"][number]
  >();
  for (const r of merged) {
    if (r.raw && !refMap.has(r.raw)) {
      refMap.set(r.raw, r);
    }
  }
  return Array.from(refMap.values());
}

/**
 * Locates the bibliography page range inside a parsed document, shared by both
 * the scanned (Mistral OCR) and born-digital (pdf-inspector) parsing paths.
 *
 * Search begins at 60% of the document: it first looks for an explicit
 * bibliography heading, falls back to a loose keyword match, and stops at the
 * next heading or a hard cap of 30 pages.
 *
 * @param pages - Parsed pages in reading order.
 * @param getMarkdown - Extracts the markdown text of one page.
 * @returns The bibliography page slice, or an empty array when none is found.
 */
export function findBibliographyPages<T>(
  pages: T[],
  getMarkdown: (page: T) => string,
): T[] {
  const bibHeadingRegex =
    /(^|\n)(#+\s*|\b)(Kaynakça|Kaynaklar|Kaynak\s+Dizini|Yararlanılan\s+Kaynaklar|Başvurulan\s+Kaynaklar|Referanslar|Atıfta\s+Bulunulan\s+Kaynaklar|Kaynak\s+Listesi|References(\s+and\s+Notes)?|Reference\s+List|Bibliography|Works\s+Cited|Works\s+Consulted|Literature\s+Cited|Cited\s+Literature|Selected\s+(Bibliography|References)|Literaturverzeichnis|Literatur|Références|Bibliographie|Referencias|Bibliografía)\b/i;

  let bibStartPageIndex = -1;
  const searchStart = Math.floor(pages.length * 0.6);

  for (let i = searchStart; i < pages.length; i++) {
    if (bibHeadingRegex.test(getMarkdown(pages[i]))) {
      bibStartPageIndex = i;
      break;
    }
  }

  if (bibStartPageIndex === -1) {
    for (let i = searchStart; i < pages.length; i++) {
      if (
        /(references|bibliography|kaynakça|kaynaklar|referanslar|works\s+cited)/i.test(
          getMarkdown(pages[i]),
        )
      ) {
        bibStartPageIndex = i;
        break;
      }
    }
  }

  let bibEndPageIndex = pages.length;
  if (bibStartPageIndex !== -1) {
    for (let i = bibStartPageIndex + 1; i < pages.length; i++) {
      if (/(^|\n)#{1,4}\s+\S+/.test(getMarkdown(pages[i]))) {
        bibEndPageIndex = i;
        break;
      }
    }
  }

  return bibStartPageIndex !== -1
    ? pages.slice(
        bibStartPageIndex,
        Math.min(bibEndPageIndex, bibStartPageIndex + 30),
      )
    : [];
}
