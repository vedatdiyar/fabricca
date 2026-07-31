import "@/lib/polyfills/math-sum-precise";
import { getDocumentProxy } from "unpdf";
import type { PageLayoutReport, PdfLayoutAnalysis, TextItem } from "./types";
import { analyzePageLayout, extractColumnAwareText } from "./layout-analyzer";

const SAMPLE_PAGE_LIMIT = 20;
const SCAN_THRESHOLD = 50;
const MULTI_COLUMN_PAGE_RATIO = 0.4;
const COMPLEX_LAYOUT_PAGE_RATIO = 0.3;

/**
 * Analyzes PDF layout structure using a fast 20-page sampling window.
 *
 * Samples the first 20 pages to inspect line-start coordinates and text density.
 * Text PDFs (single or multi-column) are extracted locally with column awareness in <200ms.
 * Scanned PDFs (avgCharsPerPage < SCAN_THRESHOLD) route to LlamaParse API for high-precision OCR.
 *
 * @param buffer - PDF binary buffer
 * @returns PdfLayoutAnalysis object containing routing decision and extracted text
 */
export async function analyzePdfLayout(
  buffer: Buffer,
): Promise<PdfLayoutAnalysis> {
  const data = new Uint8Array(buffer);
  const doc = await getDocumentProxy(data);

  const pageCount = doc.numPages;
  const sampledPageCount = Math.min(SAMPLE_PAGE_LIMIT, pageCount);

  const layoutReports: PageLayoutReport[] = [];
  const pageTexts: string[] = new Array<string>(pageCount);
  let sampledTotalChars = 0;

  // 1. Sample first 20 pages for layout analysis and text extraction
  for (let i = 1; i <= sampledPageCount; i++) {
    try {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent();

      const items: TextItem[] = textContent.items
        .filter((it: Record<string, unknown>) => typeof it.str === "string")
        .map((it: Record<string, unknown>) => ({
          str: (it.str as string) || "",
          x: (it.transform as number[])[4] || 0,
          y: (it.transform as number[])[5] || 0,
        }));

      const report = analyzePageLayout(items, viewport.width, i);
      layoutReports.push(report);
      sampledTotalChars += report.charCount;

      const textExtracted = extractColumnAwareText(
        items,
        viewport.width,
        viewport.height,
      );
      pageTexts[i - 1] = textExtracted
        ? `[PDFSayfa ${i}]\n${textExtracted}`
        : "";
    } catch {
      layoutReports.push({
        pageIndex: i,
        columnCount: 1,
        hasLineScatter: false,
        itemCount: 0,
        charCount: 0,
        gapThreshold: null,
      });
      pageTexts[i - 1] = "";
    }
  }

  const avgCharsPerPage =
    sampledPageCount > 0 ? sampledTotalChars / sampledPageCount : 0;
  const isScanned = avgCharsPerPage < SCAN_THRESHOLD;

  const multiColPages = layoutReports.filter((r) => r.columnCount >= 2);
  const scatterPages = layoutReports.filter((r) => r.hasLineScatter);

  const multiColPageIndices = multiColPages.map((r) => r.pageIndex);
  const scatterPageIndices = scatterPages.map((r) => r.pageIndex);

  const isMultiColumn =
    multiColPages.length >= sampledPageCount * MULTI_COLUMN_PAGE_RATIO;
  const hasComplexLayout =
    scatterPages.length >= sampledPageCount * COMPLEX_LAYOUT_PAGE_RATIO;

  let route: "local" | "unstructured-fallback";
  let reason: string;

  if (isScanned) {
    route = "unstructured-fallback";
    reason = `Scanned PDF (OCR Required): ${avgCharsPerPage.toFixed(1)} chars/page < ${SCAN_THRESHOLD} threshold (sampled ${sampledPageCount} pages)`;
  } else if (
    hasComplexLayout &&
    scatterPages.length >= sampledPageCount * 0.5
  ) {
    // Extreme line scatter across >50% pages indicates corrupted or chaotic PDF vector text
    route = "unstructured-fallback";
    reason = `Chaotic/Broken Layout (LlamaParse Required): ${scatterPages.length}/${sampledPageCount} pages have extreme line scatter`;
  } else if (isMultiColumn) {
    const pagesStr = multiColPageIndices.join(",");
    reason = `Multi-column local extraction: ${multiColPages.length}/${sampledPageCount} sampled pages — pages: [${pagesStr}]`;
    route = "local";
  } else if (hasComplexLayout) {
    const pagesStr = scatterPageIndices.join(",");
    reason = `Complex layout local extraction: ${scatterPages.length}/${sampledPageCount} sampled pages — pages: [${pagesStr}]`;
    route = "local";
  } else {
    route = "local";
    reason = `Single-column: ${pageCount} total pages, sampled ${sampledPageCount} pages, ${avgCharsPerPage.toFixed(1)} chars/page avg`;
  }

  // If fallback route is chosen, destroy doc immediately without extracting remaining pages
  if (route === "unstructured-fallback") {
    try {
      const docAny = doc as unknown as { destroy: () => Promise<void> };
      await docAny.destroy();
    } catch {
      /* ignore */
    }
    return {
      route,
      reason,
      fullText: "",
      pageCount,
      sampledPageCount,
      totalChars: sampledTotalChars,
      avgCharsPerPage,
      isScanned,
      isMultiColumn,
      hasComplexLayout,
      multiColPageIndices,
      scatterPageIndices,
    };
  }

  // 2. Local path: extract text for remaining pages (sampledPageCount + 1 ... pageCount)
  for (let i = sampledPageCount + 1; i <= pageCount; i++) {
    try {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent();
      const items: TextItem[] = textContent.items
        .filter((it: Record<string, unknown>) => typeof it.str === "string")
        .map((it: Record<string, unknown>) => ({
          str: (it.str as string) || "",
          x: (it.transform as number[])[4] || 0,
          y: (it.transform as number[])[5] || 0,
        }));
      const textExtracted = extractColumnAwareText(
        items,
        viewport.width,
        viewport.height,
      );
      pageTexts[i - 1] = textExtracted
        ? `[PDFSayfa ${i}]\n${textExtracted}`
        : "";
    } catch {
      pageTexts[i - 1] = "";
    }
  }

  try {
    const docAny = doc as unknown as { destroy: () => Promise<void> };
    await docAny.destroy();
  } catch {
    /* ignore */
  }

  const fullText = pageTexts.join("\n\n");

  return {
    route,
    reason,
    fullText,
    pageCount,
    sampledPageCount,
    totalChars: fullText.length,
    avgCharsPerPage,
    isScanned,
    isMultiColumn,
    hasComplexLayout,
    multiColPageIndices,
    scatterPageIndices,
  };
}
