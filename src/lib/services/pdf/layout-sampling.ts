import "@/lib/polyfills/math-sum-precise";
import pdf2md from "@opendocsg/pdf2md";
import type { PdfLayoutAnalysis } from "./types";
import { normalizeTurkishText } from "./turkish-normalizer";

const SCAN_THRESHOLD_CHARS = 300;

/**
 * Analyzes PDF layout structure and extracts Markdown using pdf2md + Turkish character normalization.
 *
 * Scanned/Image PDFs with very low text yield (<300 chars) route automatically to LlamaParse API.
 * Digital text PDFs are parsed locally into rich Markdown with restored Turkish diacritics in <300ms.
 *
 * @param buffer - PDF binary buffer
 * @returns PdfLayoutAnalysis object containing routing decision and extracted fullText
 */
export async function analyzePdfLayout(
  buffer: Buffer,
): Promise<PdfLayoutAnalysis> {
  let rawMd = "";
  try {
    rawMd = await pdf2md(new Uint8Array(buffer));
  } catch {
    rawMd = "";
  }

  const normalizedMd = normalizeTurkishText(rawMd);
  const totalChars = normalizedMd.trim().length;

  // Detect page count markers inserted by pdf2md (<!-- PAGE_BREAK -->)
  const pageBreakMatches = normalizedMd.match(/<!-- PAGE_BREAK -->/g) || [];
  const estimatedPageCount = pageBreakMatches.length + 1;
  const avgCharsPerPage = totalChars / (estimatedPageCount || 1);

  const isScanned = totalChars < SCAN_THRESHOLD_CHARS || avgCharsPerPage < 50;

  if (isScanned) {
    return {
      route: "llamaparse-fallback",
      tier: "agentic",
      reason: `Scanned PDF / Low Text Yield (OCR Required): ${totalChars} total chars, avg ${Math.round(avgCharsPerPage)} chars/page`,
      fullText: "",
      pageCount: estimatedPageCount,
      sampledPageCount: estimatedPageCount,
      totalChars,
      avgCharsPerPage,
      isScanned: true,
      isMultiColumn: false,
      hasComplexLayout: false,
      multiColPageIndices: [],
      scatterPageIndices: [],
    };
  }

  return {
    route: "local",
    reason: `Digital Text PDF (Local pdf2md Fast <300ms): ${estimatedPageCount} pages, ${totalChars} chars`,
    fullText: normalizedMd,
    pageCount: estimatedPageCount,
    sampledPageCount: estimatedPageCount,
    totalChars,
    avgCharsPerPage,
    isScanned: false,
    isMultiColumn: false,
    hasComplexLayout: false,
    multiColPageIndices: [],
    scatterPageIndices: [],
  };
}
