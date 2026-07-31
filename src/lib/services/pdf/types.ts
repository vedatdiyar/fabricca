/**
 * Represents a raw text item extracted from a PDF page with coordinate metadata.
 */
export interface TextItem {
  str: string;
  x: number;
  y: number;
}

/**
 * Detailed report of page layout structure and column detection.
 */
export interface PageLayoutReport {
  pageIndex: number;
  columnCount: number;
  hasLineScatter: boolean;
  itemCount: number;
  charCount: number;
  gapThreshold: number | null;
}

/**
 * Result of full PDF layout analysis and routing decision.
 */
export interface PdfLayoutAnalysis {
  route: "local" | "unstructured-fallback";
  reason: string;
  fullText: string;
  pageCount: number;
  sampledPageCount: number;
  totalChars: number;
  avgCharsPerPage: number;
  isScanned: boolean;
  isMultiColumn: boolean;
  hasComplexLayout: boolean;
  multiColPageIndices: number[];
  scatterPageIndices: number[];
}
