import { PDFDocument } from "pdf-lib";

/**
 * Loads a PDF buffer into a reusable PDFDocument instance.
 *
 * @param pdfBuffer - The raw PDF file content.
 * @returns The loaded PDFDocument ready for batch extraction.
 */
export async function loadPdfSource(pdfBuffer: Buffer): Promise<PDFDocument> {
  return PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
}

/**
 * Returns the total page count from an already-loaded PDFDocument.
 *
 * @param doc - The loaded PDFDocument instance.
 * @returns The number of pages in the document.
 */
export function getPdfPageCount(doc: PDFDocument): number {
  return doc.getPageCount();
}

/**
 * Extracts a contiguous page range from a pre-loaded PDFDocument into a standalone mini-PDF buffer.
 *
 * @param doc - The already-loaded source PDFDocument.
 * @param startPage - 1-based inclusive start page.
 * @param endPage - 1-based inclusive end page.
 * @returns A new PDF buffer containing only the specified pages.
 */
export async function extractBatchFromDoc(
  doc: PDFDocument,
  startPage: number,
  endPage: number,
): Promise<Buffer> {
  const totalPages = doc.getPageCount();

  const safeStart = Math.max(1, startPage);
  const safeEnd = Math.min(endPage, totalPages);

  if (safeStart > safeEnd) {
    throw new Error(
      `Geçersiz sayfa aralığı: startPage=${startPage}, endPage=${endPage}, toplam=${totalPages}`,
    );
  }

  const destDoc = await PDFDocument.create();
  const pageIndices = Array.from(
    { length: safeEnd - safeStart + 1 },
    (_, i) => safeStart - 1 + i,
  );

  const copiedPages = await destDoc.copyPages(doc, pageIndices);
  for (const page of copiedPages) {
    destDoc.addPage(page);
  }

  const pdfBytes = await destDoc.save();
  return Buffer.from(pdfBytes);
}
