import { type DocumentChunk } from "@/lib/services/llamaparse";

const MAX_CHUNK_CHARS = 1200; // ~300 tokens, guaranteeing all chunks stay well below Cohere's 512 token limit

/**
 * Validates whether a text line qualifies as a section title/heading in an academic document.
 *
 * @param text - Raw text string to check
 * @returns True if text is a valid section heading, false otherwise
 */
export function isValidSectionTitle(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3 || trimmed.length > 120) return false;

  const letters = trimmed.match(/[\p{L}]/gu) || [];
  if (letters.length < 3) return false;

  const nonSpaceChars = trimmed.replace(/\s/g, "");
  const letterRatio = letters.length / nonSpaceChars.length;
  if (letterRatio < 0.6) return false;

  if (/^[0-9\s.,;:*+\-/=<>(){}#%&"'^]+$/.test(trimmed)) return false;

  const isNumberedHeading = /^\d+(\.\d+)*\s+[\p{L}]/u.test(trimmed);
  const isCleanUppercase =
    trimmed === trimmed.toUpperCase() && letters.length >= 3;

  return isNumberedHeading || isCleanUppercase;
}

/**
 * Merges short adjacent micro-chunks within the same section and page.
 *
 * @param chunks - Raw document chunks
 * @returns Array of merged chunks with re-indexed chunk numbers
 */
export function mergeMicroChunks(chunks: DocumentChunk[]): DocumentChunk[] {
  if (chunks.length <= 1) return chunks;

  const result: DocumentChunk[] = [];
  const MIN_CHARS = 150;

  for (let i = 0; i < chunks.length; i++) {
    const current = chunks[i];
    if (current.content.length < MIN_CHARS && result.length > 0) {
      const prev = result[result.length - 1];
      if (
        prev.sectionTitle === current.sectionTitle &&
        (prev.printedPageNumber === current.printedPageNumber ||
          current.printedPageNumber === null)
      ) {
        prev.content = `${prev.content}\n\n${current.content}`;
        prev.tokenCount = Math.ceil(prev.content.length / 4);
        continue;
      }
    }
    result.push({ ...current });
  }

  return result.map((c, idx) => ({ ...c, chunkIndex: idx }));
}

/**
 * Enriches chunks with overlapping parent context windows for enhanced RAG retrieval.
 *
 * @param chunks - Document chunks
 * @returns Chunks enriched with parentContent field
 */
export function applyParentChildContext(
  chunks: DocumentChunk[],
): DocumentChunk[] {
  const WINDOW = 3;
  return chunks.map((c, idx) => {
    const start = Math.max(0, idx - 1);
    const end = Math.min(chunks.length, idx + WINDOW);
    const parentText = chunks
      .slice(start, end)
      .map((item) => item.content)
      .join("\n\n");

    return {
      ...c,
      parentContent: parentText,
    };
  });
}

/**
 * Splits full extracted PDF text into structured document chunks strictly capped at MAX_CHUNK_CHARS length.
 *
 * @param fullText - Full text extracted from PDF
 * @returns Array of structured document chunks with section titles and page numbers
 */
export function buildLocalChunks(fullText: string): DocumentChunk[] {
  const rawChunks: DocumentChunk[] = [];
  let chunkIndex = 0;
  const paragraphs = fullText.split("\n");
  let buffer: string[] = [];
  let bufferLen = 0;
  let currentSection: string | null = null;
  let currentPdfPage: number | null = null;
  let currentPrintedPage: number | null = null;

  function flush() {
    if (buffer.length === 0) return;
    const content = buffer.join("\n").trim();
    if (content) {
      rawChunks.push({
        chunkIndex: chunkIndex++,
        pdfPageNumber: currentPdfPage,
        printedPageNumber: currentPrintedPage ?? currentPdfPage,
        sectionTitle: currentSection,
        content,
        tokenCount: Math.ceil(content.length / 4),
      });
    }
    buffer = [];
    bufferLen = 0;
  }

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      flush();
      continue;
    }

    const pdfPageMatch = trimmed.match(/^\[PDFSayfa (\d+)\]/i);
    if (pdfPageMatch) {
      flush();
      currentPdfPage = parseInt(pdfPageMatch[1], 10);
      continue;
    }

    const printedPageMatch = trimmed.match(/\[Sayfa (\d+)\]/i);
    if (printedPageMatch) {
      currentPrintedPage = parseInt(printedPageMatch[1], 10);
    }

    if (isValidSectionTitle(trimmed)) {
      flush();
      currentSection = trimmed;
    }

    if (bufferLen + trimmed.length > MAX_CHUNK_CHARS && buffer.length > 0) {
      flush();
    }
    buffer.push(trimmed);
    bufferLen += trimmed.length;
  }
  flush();

  const merged = mergeMicroChunks(rawChunks);
  return applyParentChildContext(merged);
}
