import { PDFDocument } from "pdf-lib";

/** Statistics describing a page-slicing operation and its payload savings. */
export interface PdfSliceStats {
  requestedPageCount: number;
  slicedPageCount: number;
  originalSize: number;
  slicedSize: number;
  savedBytes: number;
  savedPercent: number;
}

/** Result of slicing a PDF: the new mini buffer plus measurable payload stats. */
export interface PdfSliceResult {
  slicedBuffer: Buffer;
  stats: PdfSliceStats;
}

/**
 * Extracts the requested 1-based page indices from a PDF buffer and returns a
 * new, smaller PDF buffer containing only those pages. Page order is preserved,
 * duplicate and out-of-range indices are ignored, and the shared resources
 * (fonts, images) of copied pages are carried over by pdf-lib. Used to upload
 * only the relevant slice to LlamaParse instead of the full document.
 *
 * @param buffer - The full PDF buffer.
 * @param requestedPages - 1-based page indices to keep (e.g. `[5, 6, 7]`).
 * @returns The sliced mini buffer plus payload savings statistics.
 * @throws If the PDF cannot be parsed or no requested page is within range.
 */
export async function slicePdfPages(
  buffer: Buffer,
  requestedPages: number[],
): Promise<PdfSliceResult> {
  const originalSize = buffer.length;

  let sourceDoc: PDFDocument;
  try {
    sourceDoc = await PDFDocument.load(new Uint8Array(buffer));
  } catch (err) {
    throw new Error(
      `PDF okunamadı, sayfa kesimi başarısız oldu: ${(err as Error).message}`,
    );
  }

  const totalPages = sourceDoc.getPageCount();
  const uniqueRequested = [...new Set(requestedPages)];
  const validPages = uniqueRequested
    .filter((p) => Number.isInteger(p) && p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  if (validPages.length === 0) {
    throw new Error(
      `Sayfa kesimi için geçerli sayfa kalmadı (istenen: ${uniqueRequested.join(", ")}; PDF sayfa sayısı: ${totalPages})`,
    );
  }

  const outputDoc = await PDFDocument.create();
  const sourceIndices = validPages.map((p) => p - 1);
  const copiedPages = await outputDoc.copyPages(sourceDoc, sourceIndices);
  for (const page of copiedPages) {
    outputDoc.addPage(page);
  }

  const bytes = await outputDoc.save();
  const slicedBuffer = Buffer.from(bytes);
  const slicedSize = slicedBuffer.length;

  return {
    slicedBuffer,
    stats: {
      requestedPageCount: uniqueRequested.length,
      slicedPageCount: validPages.length,
      originalSize,
      slicedSize,
      savedBytes: Math.max(0, originalSize - slicedSize),
      savedPercent:
        originalSize > 0 ? (1 - slicedSize / originalSize) * 100 : 0,
    },
  };
}
