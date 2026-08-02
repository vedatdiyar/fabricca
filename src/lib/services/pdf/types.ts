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

/** Result of full PDF layout analysis and routing decision. */
export interface PdfLayoutAnalysis {
  route: "local" | "llamaparse-fallback";
  tier?: "fast" | "cost_effective" | "agentic";
  reason: string;
  fullText: string;
  pageCount: number;
  sampledPageCount: number;
  totalChars: number;
  avgCharsPerPage: number;
  isScanned: boolean;
  isMultiColumn: boolean;
  hasComplexLayout: boolean;
  isImageDominated: boolean;
  hasInvisibleText: boolean;
  hasUnreliableText: boolean;
  multiColPageIndices: number[];
  scatterPageIndices: number[];
  imageDominatedPageIndices: number[];
  invisibleTextPageIndices: number[];
  unreliableTextPageIndices: number[];
}

/**
 * Page label for the 4-step hybrid engine:
 * A = free local pdf2md, B = light LlamaParse cost_effective, C = heavy LlamaParse agentic.
 */
export type PageLabel = "A" | "B" | "C";

/** Classification result for a single page. */
export interface PageClassification {
  pageIndex: number;
  label: PageLabel;
  reason: string;
  signals: SampledPageReport;
}

/** Consecutive group of pages sharing the same label. */
export interface PageBatch {
  label: PageLabel;
  startPage: number;
  endPage: number;
  pageCount: number;
  /** Only for B/C batches; 'agentic' is used for a single combined job when both exist. */
  llamaParseTier?: "cost_effective" | "agentic";
}

/** Markdown output for a single page. */
export interface PageMarkdown {
  pageIndex: number;
  markdown: string;
  source: "local" | "llamaparse";
  label: PageLabel;
}

/** Step 1 output: classification of every page. */
export interface FullScanResult {
  pageCount: number;
  classifications: PageClassification[];
  labelSummary: {
    classA: number;
    classB: number;
    classC: number;
  };
  scanDurationMs: number;
}

/** Step 2 output: result of processing all batches in parallel. */
export interface BatchProcessingResult {
  pages: PageMarkdown[];
  batchStats: {
    localBatchCount: number;
    apiBatchCount: number;
    localPageCount: number;
    apiPageCount: number;
    totalDurationMs: number;
    /** Total bytes of PDF payload uploaded to the API after page slicing. */
    apiPayloadBytes?: number;
    /** Bytes saved versus uploading the full PDF once per API batch. */
    savedPayloadBytes?: number;
  };
}

/** Step 3 output: Markdown merged, repaired, and cleaned across engines. */
export interface StitchedMarkdown {
  fullMarkdown: string;
  repairsApplied: {
    paragraphJoins: number;
    hyphenRepairs: number;
    headerFooterRemovals: number;
  };
}

/** Step 4 output: final Markdown after style normalization. */
export interface NormalizedMarkdown {
  markdown: string;
  normalizationsApplied: {
    headingLevelFixes: number;
    listSymbolFixes: number;
    footnoteConversions: number;
  };
}

/** Full output of the 4-step hybrid pipeline, returned by pdf-parser for logging. */
export interface HybridPipelineAnalysis {
  fullScan: FullScanResult;
  batchStats: BatchProcessingResult["batchStats"];
  repairsApplied: StitchedMarkdown["repairsApplied"];
  normalizationsApplied: NormalizedMarkdown["normalizationsApplied"];
  totalDurationMs: number;
}
