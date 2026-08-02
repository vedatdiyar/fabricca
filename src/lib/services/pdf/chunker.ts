import {
  MarkdownTextSplitter,
  RecursiveCharacterTextSplitter,
} from "@langchain/textsplitters";
import { type DocumentChunk } from "@/lib/services/llamaparse";

const TARGET_CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: TARGET_CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
  separators: ["\n\n", "\n", ". ", "? ", "! ", " ", ""],
});

const markdownSplitter = new MarkdownTextSplitter({
  chunkSize: TARGET_CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
});

/**
 * Whether a text line qualifies as a section title or heading in an academic document.
 *
 * @param text - Text line to evaluate.
 * @returns True if the line looks like a section title.
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
 * @param chunks - Document chunks to merge.
 * @returns Merged chunks with recomputed chunk indices.
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
 * Enriches chunks with overlapping parent context windows for better RAG retrieval.
 *
 * @param chunks - Document chunks to enrich.
 * @returns Chunks with parent context content attached.
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
 * Whether a chunk is trivial noise, such as standalone horizontal rules or junk symbols.
 *
 * @param content - Chunk content to evaluate.
 * @returns True if the chunk is noise.
 */
export function isNoiseChunk(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length < 5) {
    if (!/[\p{L}0-9]/u.test(trimmed)) return true;
  }
  if (/^[*\-_\s]{3,}$/.test(trimmed)) return true;
  return false;
}

/**
 * Splits full extracted PDF text into document chunks grouped by section titles and page markers.
 *
 * @param fullText - Full extracted PDF text.
 * @returns A promise resolving to the merged and enriched document chunks.
 */
export async function buildLocalChunks(
  fullText: string,
): Promise<DocumentChunk[]> {
  const rawChunks: DocumentChunk[] = [];
  let chunkIndex = 0;
  const lines = fullText.split("\n");

  let currentSection: string | null = null;
  let currentPdfPage: number | null = null;
  let currentPrintedPage: number | null = null;
  let currentBuffer: string[] = [];

  /** Flushes the current buffered lines into chunks, splitting long blocks. */
  async function processBuffer() {
    if (currentBuffer.length === 0) return;
    const textBlock = currentBuffer.join("\n").trim();
    if (!textBlock) {
      currentBuffer = [];
      return;
    }

    if (textBlock.length <= TARGET_CHUNK_SIZE) {
      if (!isNoiseChunk(textBlock)) {
        rawChunks.push({
          chunkIndex: chunkIndex++,
          pdfPageNumber: currentPdfPage,
          printedPageNumber: currentPrintedPage ?? currentPdfPage,
          sectionTitle: currentSection,
          content: textBlock,
          tokenCount: Math.ceil(textBlock.length / 4),
        });
      }
    } else {
      const subTexts = await textSplitter.splitText(textBlock);
      for (const subText of subTexts) {
        const clean = subText.trim();
        if (clean && !isNoiseChunk(clean)) {
          rawChunks.push({
            chunkIndex: chunkIndex++,
            pdfPageNumber: currentPdfPage,
            printedPageNumber: currentPrintedPage ?? currentPdfPage,
            sectionTitle: currentSection,
            content: clean,
            tokenCount: Math.ceil(clean.length / 4),
          });
        }
      }
    }
    currentBuffer = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const pdfPageMatch = trimmed.match(/^\[PDFSayfa (\d+)\]/i);
    if (pdfPageMatch) {
      await processBuffer();
      currentPdfPage = parseInt(pdfPageMatch[1], 10);
      continue;
    }

    const printedPageMatch = trimmed.match(/\[Sayfa (\d+)\]/i);
    if (printedPageMatch) {
      currentPrintedPage = parseInt(printedPageMatch[1], 10);
    }

    if (isValidSectionTitle(trimmed)) {
      await processBuffer();
      currentSection = trimmed;
    }

    currentBuffer.push(trimmed);
  }
  await processBuffer();

  const merged = mergeMicroChunks(rawChunks);
  return applyParentChildContext(merged);
}

/**
 * Builds chunks from normalized Markdown using heading structure rather than page markers.
 *
 * @param normalizedMarkdown - Normalized Markdown to chunk.
 * @returns A promise resolving to the merged and enriched document chunks.
 */
export async function buildLocalChunksFromMarkdown(
  normalizedMarkdown: string,
): Promise<DocumentChunk[]> {
  if (!normalizedMarkdown.trim()) return [];

  const rawChunks: DocumentChunk[] = [];
  let chunkIdx = 0;
  let currentSectionTitle: string | null = null;
  let currentPageNum: number | null = null;

  const blocks = await markdownSplitter.splitText(normalizedMarkdown);

  for (const block of blocks) {
    const cleanBlock = block.trim();
    if (!cleanBlock || isNoiseChunk(cleanBlock)) continue;

    const headerMatch = cleanBlock.match(/^(#{1,4})\s+(.+)$/m);
    if (headerMatch) {
      currentSectionTitle = headerMatch[2].slice(0, 120).trim();
    }

    if (
      currentSectionTitle &&
      /^(index|dizin)(\s+|$)/i.test(currentSectionTitle)
    ) {
      continue;
    }

    const pageMatch = cleanBlock.match(/\[PDFSayfa\s+(\d+)\]/i);
    if (pageMatch) {
      currentPageNum = parseInt(pageMatch[1], 10);
    }

    if (cleanBlock.length > TARGET_CHUNK_SIZE) {
      const subTexts = await textSplitter.splitText(cleanBlock);
      for (const subText of subTexts) {
        const clean = subText.trim();
        if (clean && !isNoiseChunk(clean)) {
          rawChunks.push({
            chunkIndex: chunkIdx++,
            pdfPageNumber: currentPageNum,
            printedPageNumber: currentPageNum,
            sectionTitle: currentSectionTitle,
            content: clean,
            tokenCount: Math.ceil(clean.length / 4),
          });
        }
      }
    } else {
      rawChunks.push({
        chunkIndex: chunkIdx++,
        pdfPageNumber: currentPageNum,
        printedPageNumber: currentPageNum,
        sectionTitle: currentSectionTitle,
        content: cleanBlock,
        tokenCount: Math.ceil(cleanBlock.length / 4),
      });
    }
  }

  const merged = mergeMicroChunks(rawChunks);
  return applyParentChildContext(merged);
}
