/** Raw text item extracted from a PDF page with coordinate metadata. */
export interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Visual (operator-list) signals describing the page's rendering instructions. */
export interface PageVisualSignals {
  imageAreaRatio: number;
  fontCount: number;
  hasInvisibleText: boolean;
}

/** Text-layer quality signals. */
export interface PageTextQuality {
  textAreaRatio: number;
  textUnreliable: boolean;
}

/** Detailed report of page layout structure and column detection. */
export interface PageLayoutReport {
  pageIndex: number;
  columnCount: number;
  hasLineScatter: boolean;
  charCount: number;
}

/** Combined per-page report: layout structure + visual signals + text quality. */
export interface SampledPageReport
  extends PageLayoutReport, PageVisualSignals, PageTextQuality {}

/** Primary processing engine strategy selected for a PDF document. */
export type DocumentStrategyType = "PDF2MD" | "LLAMAPARSE";

/** Result of document-level sampling and strategy classification. */
export interface DocumentStrategyResult {
  strategy: DocumentStrategyType;
  pageCount: number;
  sampledPages: number[];
  reason: string;
  scannedRatio: number;
  unreliableTextRatio: number;
  scanDurationMs: number;
}

/** Markdown output for a single page. */
export interface PageMarkdown {
  pageIndex: number;
  markdown: string;
  source: "local" | "llamaparse";
  label: "A" | "B" | "C";
}

/** Output of style normalization applied to Markdown. */
export interface NormalizedMarkdown {
  markdown: string;
  normalizationsApplied: {
    headingLevelFixes: number;
    listSymbolFixes: number;
    footnoteConversions: number;
  };
}
