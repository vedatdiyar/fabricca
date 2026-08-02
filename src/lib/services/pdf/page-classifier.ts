import "@/lib/polyfills/math-sum-precise";
import { getDocumentProxy } from "unpdf";
import { analyzePageLayout } from "./layout-analyzer";
import { analyzePageVisualSignals } from "./layout-signals";
import { analyzeTextQuality } from "./quality-signals";
import type {
  DocumentStrategyResult,
  SampledPageReport,
  TextItem,
} from "./types";

/** Class C: max char count for a purely scanned image page. */
const SCANNED_CHAR_LIMIT = 50;
/** Class C: min image area ratio for a purely scanned image page. */
const SCANNED_IMAGE_RATIO = 0.5;

/**
 * Extracts the combined signal report (layout, visual, and quality) for one page.
 *
 * @param doc - PDF document proxy to read the page from.
 * @param pageIndex - One-based index of the page to analyze.
 * @returns Combined layout, visual, and text-quality signals for the page.
 */
async function extractPageReport(
  doc: Awaited<ReturnType<typeof getDocumentProxy>>,
  pageIndex: number,
): Promise<SampledPageReport> {
  const page = await doc.getPage(pageIndex);
  const viewport = page.getViewport({ scale: 1.0 });

  const [textContent, operatorList] = await Promise.all([
    page.getTextContent(),
    page.getOperatorList(),
  ]);

  const items: TextItem[] = textContent.items
    .filter((it: Record<string, unknown>) => typeof it.str === "string")
    .map((it: Record<string, unknown>) => ({
      str: (it.str as string) || "",
      x: (it.transform as number[])[4] || 0,
      y: (it.transform as number[])[5] || 0,
      width: (it.width as number) || 0,
      height: (it.height as number) || 0,
    }));

  const layout = analyzePageLayout(items, viewport.width, pageIndex);
  const visual = await analyzePageVisualSignals(
    operatorList,
    viewport.width,
    viewport.height,
  );
  const quality = analyzeTextQuality(items, viewport.width, viewport.height);

  return { ...layout, ...visual, ...quality };
}

/**
 * Selects representative sample page indices for document-level strategy classification.
 *
 * @param pageCount - Total number of pages in the PDF document.
 * @returns An array of 1-based page indices to sample.
 */
function getSampledPageIndices(pageCount: number): number[] {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const indices = [
    1,
    2,
    Math.floor(pageCount / 2),
    Math.floor((3 * pageCount) / 4),
    pageCount,
  ];

  return Array.from(new Set(indices)).sort((a, b) => a - b);
}

/**
 * Samples key pages of a PDF document to determine a single processing engine strategy (PDF2MD vs LlamaParse).
 *
 * @param buffer - The raw PDF file content as a byte buffer.
 * @returns Document strategy classification result including reason and page statistics.
 */
export async function classifyDocumentStrategy(
  buffer: Buffer,
): Promise<DocumentStrategyResult> {
  const scanStart = performance.now();

  const data = new Uint8Array(buffer);
  const doc = await getDocumentProxy(data);
  const pageCount = doc.numPages;

  const sampledPages = getSampledPageIndices(pageCount);

  const reports = await Promise.all(
    sampledPages.map((pageIndex) => extractPageReport(doc, pageIndex)),
  );

  try {
    const docAny = doc as unknown as { destroy: () => Promise<void> };
    await docAny.destroy();
  } catch {
    /* ignore */
  }

  let scannedCount = 0;
  let unreliableCount = 0;

  for (const r of reports) {
    const isScannedPage =
      r.charCount < SCANNED_CHAR_LIMIT &&
      r.imageAreaRatio > SCANNED_IMAGE_RATIO;
    if (isScannedPage) {
      scannedCount++;
    }
    if (r.textUnreliable) {
      unreliableCount++;
    }
  }

  const scannedRatio = scannedCount / sampledPages.length;
  const unreliableTextRatio = unreliableCount / sampledPages.length;

  const isLlamaParseNeeded = scannedRatio >= 0.4 || unreliableTextRatio >= 0.3;

  const strategy = isLlamaParseNeeded ? "LLAMAPARSE" : "PDF2MD";
  const reason = isLlamaParseNeeded
    ? `Doküman taranmış görsel veya bozuk metin içeriyor (taranmış sayfa oranı: %${Math.round(scannedRatio * 100)}, bozuk metin oranı: %${Math.round(unreliableTextRatio * 100)})`
    : `Temiz dijital metin katmanı tespit edildi (${sampledPages.length} sayfa örneklemesi)`;

  return {
    strategy,
    pageCount,
    sampledPages,
    reason,
    scannedRatio,
    unreliableTextRatio,
    scanDurationMs: Math.round(performance.now() - scanStart),
  };
}
