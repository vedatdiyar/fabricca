import "@/lib/polyfills/math-sum-precise";
import { getDocumentProxy } from "unpdf";
import { analyzePageLayout } from "./layout-analyzer";
import { analyzePageVisualSignals } from "./layout-signals";
import { analyzeTextQuality } from "./quality-signals";
import type {
  FullScanResult,
  PageClassification,
  PageLabel,
  SampledPageReport,
  TextItem,
} from "./types";

/** Class C: max char count for a purely scanned image page. */
const CLASS_C_SCAN_CHAR_LIMIT = 50;
/** Class C: min image area ratio for a purely scanned image page. */
const CLASS_C_SCAN_IMAGE_RATIO = 0.5;
/** Class C: max char count for dense vector/diagram content. */
const CLASS_C_VECTOR_CHAR_LIMIT = 30;
/** Class B: min image area ratio for sidecar detection. */
const CLASS_B_SIDECAR_IMAGE_RATIO = 0.5;
/** Class B: min text area ratio for sidecar detection. */
const CLASS_B_SIDECAR_TEXT_RATIO_MIN = 0.05;
/** Parallel page analysis chunk size (memory/CPU balance). */
const PARALLEL_CHUNK_SIZE = 20;

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
 * Labels a single page report as A, B, or C based on the first matching rule.
 *
 * @param report - Combined signal report for the page.
 * @param totalPageCount - Total number of pages in the document.
 * @returns The assigned page label and its reason.
 */
function classifyPage(
  report: SampledPageReport,
  totalPageCount: number,
): {
  label: PageLabel;
  reason: string;
} {
  const {
    pageIndex,
    charCount,
    imageAreaRatio,
    textAreaRatio,
    textUnreliable,
    hasInvisibleText,
    hasLineScatter,
    columnCount,
  } = report;

  const isOuterCoverPage = pageIndex === 1 || pageIndex === totalPageCount;
  if (
    isOuterCoverPage &&
    charCount < CLASS_C_SCAN_CHAR_LIMIT &&
    imageAreaRatio > CLASS_C_SCAN_IMAGE_RATIO
  ) {
    return {
      label: "A",
      reason: `Dekoratif ön/arka kapak (sayfa ${pageIndex}/${totalPageCount}, yerel pass)`,
    };
  }

  if (
    charCount < CLASS_C_SCAN_CHAR_LIMIT &&
    imageAreaRatio > CLASS_C_SCAN_IMAGE_RATIO
  ) {
    return {
      label: "C",
      reason: `Saf taranmış resim (charCount=${charCount} < ${CLASS_C_SCAN_CHAR_LIMIT}, imageArea=${(imageAreaRatio * 100).toFixed(0)}%)`,
    };
  }

  if (textUnreliable) {
    return {
      label: "C",
      reason: `Bozuk/okunamaz metin katmanı (cid/fffd/PUA oranı > %5)`,
    };
  }

  if (hasInvisibleText && textUnreliable) {
    return {
      label: "C",
      reason: `Görünmez metin katmanı (Render Mode 3) + bozuk metin`,
    };
  }

  if (charCount < CLASS_C_VECTOR_CHAR_LIMIT && hasLineScatter) {
    return {
      label: "C",
      reason: `Yoğun vektörel/şema içeriği (charCount=${charCount} < ${CLASS_C_VECTOR_CHAR_LIMIT}, lineScatter=true)`,
    };
  }

  if (columnCount >= 2) {
    return {
      label: "B",
      reason: `Çok sütunlu düzen (columnCount=${columnCount})`,
    };
  }

  if (hasLineScatter) {
    return {
      label: "B",
      reason: `Tablo/grid/scatter düzeni (hasLineScatter=true)`,
    };
  }

  if (
    imageAreaRatio > CLASS_B_SIDECAR_IMAGE_RATIO &&
    textAreaRatio >= CLASS_B_SIDECAR_TEXT_RATIO_MIN &&
    !textUnreliable
  ) {
    return {
      label: "B",
      reason: `Sidecar düzen: görsel yoğun (imageArea=${(imageAreaRatio * 100).toFixed(0)}%) + temiz metin katmanı (textArea=${(textAreaRatio * 100).toFixed(0)}%)`,
    };
  }

  return {
    label: "A",
    reason: `Temiz dijital metin (charCount=${charCount}, cols=${columnCount}, imageArea=${(imageAreaRatio * 100).toFixed(0)}%)`,
  };
}

/**
 * Scans every page with unpdf and assigns an A, B, or C label in parallel chunks.
 *
 * @param buffer - Raw PDF file buffer.
 * @returns Full scan result with per-page classifications and summary.
 */
export async function classifyAllPages(
  buffer: Buffer,
): Promise<FullScanResult> {
  const scanStart = performance.now();

  const data = new Uint8Array(buffer);
  const doc = await getDocumentProxy(data);
  const pageCount = doc.numPages;

  const allIndices = Array.from({ length: pageCount }, (_, i) => i + 1);
  const classifications: PageClassification[] = [];

  for (let i = 0; i < allIndices.length; i += PARALLEL_CHUNK_SIZE) {
    const chunkIndices = allIndices.slice(i, i + PARALLEL_CHUNK_SIZE);

    const chunkResults = await Promise.all(
      chunkIndices.map(async (pageIndex) => {
        try {
          const report = await extractPageReport(doc, pageIndex);
          const { label, reason } = classifyPage(report, pageCount);
          return {
            pageIndex,
            label,
            reason,
            signals: report,
          } satisfies PageClassification;
        } catch (err) {
          throw new Error(
            `Sayfa sınıflandırması başarısız (sayfa ${pageIndex}): ${(err as Error).message}`,
          );
        }
      }),
    );

    classifications.push(...chunkResults);
  }

  try {
    const docAny = doc as unknown as { destroy: () => Promise<void> };
    await docAny.destroy();
  } catch {
    /* ignore */
  }

  const scannedCount = classifications.filter(
    (c) => c.signals.charCount < 50 || c.signals.textUnreliable,
  ).length;
  const scannedRatio = scannedCount / pageCount;

  if (scannedRatio >= 0.8 && pageCount > 1) {
    classifications.forEach((c) => {
      c.label = "C";
      c.reason = `Tamamen taranmış resim PDF (${(scannedRatio * 100).toFixed(0)}% taranmış, doğrudan LlamaParse OCR)`;
    });
  }

  const classA = classifications.filter((c) => c.label === "A").length;
  const classB = classifications.filter((c) => c.label === "B").length;
  const classC = classifications.filter((c) => c.label === "C").length;

  return {
    pageCount,
    classifications,
    labelSummary: { classA, classB, classC },
    scanDurationMs: Math.round(performance.now() - scanStart),
  };
}
