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
 * Heuristic check for pages containing dense numbered citations (e.g. 1. Author..., 20. Author...).
 * Detects notes/references even if section headings are missing or omitted by OCR.
 *
 * @param text - The page markdown text to inspect.
 * @returns True when the page has high citation/note density.
 */
export function isReferenceDensityPage(text: string): boolean {
  if (!text || text.length < 100) return false;
  // Match lines starting with numbers like "1. ", "20. ", "[1] ", "[20] " followed by capital letter
  const numberedLines = text.match(
    /(^|\n)\s*(\[\d{1,3}\]|\d{1,3}\.)\s+[A-ZÇĞİÖŞÜ]/g,
  );
  const numberedCount = numberedLines ? numberedLines.length : 0;

  // Match academic publication markers
  const pubMarkers = text.match(
    /\b(pp\.\s*\d+|vol\.\s*\d+|doi:\s*10\.|University\s+Press|Publishers?|Weşanên|Journal\s+of|\(\s*(19\d{2}|20\d{2})\s*\)|op\.\s*cit|ibid\b)/gi,
  );
  const pubCount = pubMarkers ? pubMarkers.length : 0;

  return numberedCount >= 3 && pubCount >= 2;
}

/**
 * Locates the bibliography/endnote page range inside a parsed document, shared by both
 * the scanned (Mistral OCR) and born-digital (pdf-inspector) parsing paths.
 *
 * Search begins at 50% of the document: it first looks for an explicit
 * bibliography/notes heading, falls back to reference density heuristic, and stops at the
 * next major body heading or a hard cap of 30 pages.
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
    /(^|\n)(#+\s*|\b)(Notes\s+and\s+References|References\s+and\s+Notes|Kaynakça\s+ve\s+Notlar|Notlar\s+ve\s+Kaynakça|Kaynakça|Kaynaklar|Kaynak\s+Dizini|Yararlanılan\s+Kaynaklar|Başvurulan\s+Kaynaklar|Referanslar|Atıfta\s+Bulunulan\s+Kaynaklar|Kaynak\s+Listesi|References|Reference\s+List|Bibliography|Works\s+Cited|Works\s+Consulted|Literature\s+Cited|Cited\s+Literature|Selected\s+(Bibliography|References)|Quellenverzeichnis|Quellen|Primary\s+Sources|Archival\s+Sources|Literaturverzeichnis|Literatur|Références|Bibliographie|Referencias|Bibliografía)\b/i;

  let bibStartPageIndex = -1;
  const searchStart = Math.floor(pages.length * 0.45);

  for (let i = searchStart; i < pages.length; i++) {
    const text = getMarkdown(pages[i]);
    if (bibHeadingRegex.test(text) || isReferenceDensityPage(text)) {
      bibStartPageIndex = i;
      break;
    }
  }

  if (bibStartPageIndex === -1) {
    for (let i = searchStart; i < pages.length; i++) {
      const text = getMarkdown(pages[i]);
      if (
        /(references|bibliography|kaynakça|kaynaklar|referanslar|works\s+cited|literature\s+cited)\b/i.test(
          text,
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
      const pageText = getMarkdown(pages[i]);
      // Stop only at explicit major body section headings, not tail end matter like bio/disclosure
      if (
        /(^|\n)#{1,2}\s+(Conclusion|Discussion|Findings|Methodology|Sonuç|Tartışma|Bulgular)\b/i.test(
          pageText,
        )
      ) {
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
