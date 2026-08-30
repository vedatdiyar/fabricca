import type { PageAnalysis } from "./schema";
import { normalizeAcademicText } from "./normalizer";
import {
  HEADING_RE,
  type HeaderState,
  INITIAL_HEADER_STATE,
  isValidSectionHeader,
  updateHeaderState,
  buildHeaderHierarchy,
  getSectionTitle,
} from "./section-headers";
import {
  formatPrintedPageNumber,
  normalizePrintedPage,
  formatPrintedPageRange,
} from "./page-format";
import { estimateTokenCount, findSentenceBoundary } from "./token-estimator";
import { buildChunkContextPrefix, buildEmbeddingText } from "./context-prefix";
import {
  type ChunkType,
  type DocumentChunk,
  isNoiseContent,
  inferChunkType,
} from "./chunk-types";

// Re-export types and helpers for backwards compatibility
export {
  type ChunkType,
  type DocumentChunk,
  isNoiseContent,
  inferChunkType,
  isValidSectionHeader,
  formatPrintedPageNumber,
  buildChunkContextPrefix,
  buildEmbeddingText,
};

const TARGET_CHUNK_SIZE_CHARS = 1200;
const CHUNK_OVERLAP_CHARS = 200;
const SOFT_LIMIT_CHARS = 1400;
const MIN_CHUNK_TOKENS = 100;

/**
 * Accumulates blocks into section-bounded chunks across page boundaries.
 */
export class ChunkBuilder {
  private readonly chunks: DocumentChunk[] = [];
  private headerState: HeaderState = { ...INITIAL_HEADER_STATE };
  private readonly bufferParts: string[] = [];
  private bufferStartPage: number | null = null;
  private bufferEndPage: number | null = null;
  private bufferChars = 0;
  private bufferPrintedPages: string[] = [];
  private lastFlushedPrintedPages: string[] = [];

  private overlapRemainder: string = "";
  private overlapStartPage: number | null = null;
  private overlapPrintedPages: string[] = [];

  /**
   * Reports the current accumulated character count of the in-progress buffer.
   *
   * @returns The number of buffered characters.
   */
  get bufferCharCount(): number {
    return this.bufferChars;
  }

  /**
   * Returns the current section title derived from header state.
   *
   * @returns The deepest section title, or null when no heading has been seen.
   */
  get currentSection(): string | null {
    return getSectionTitle(this.headerState);
  }

  /**
   * Returns the current header hierarchy.
   *
   * @returns Array of active heading titles from H1 down to the deepest level.
   */
  get currentHierarchy(): string[] {
    return buildHeaderHierarchy(this.headerState);
  }

  /**
   * Pushes a block onto the current buffer, tracking the page span and the
   * actual printed page numbers where available.
   *
   * @param text - The block text to buffer.
   * @param pageNumber - The sequential PDF page the block belongs to.
   * @param printedPageNumber - Optional printed page number from the PDF parser.
   */
  pushBlock(
    text: string,
    pageNumber: number,
    printedPageNumber?: string | null,
  ): void {
    if (this.bufferStartPage === null) {
      this.bufferStartPage = pageNumber;

      if (this.overlapRemainder) {
        this.bufferParts.push(this.overlapRemainder);
        this.bufferChars += this.overlapRemainder.length;
        if (this.overlapStartPage !== null) {
          this.bufferStartPage = this.overlapStartPage;
        }
        if (this.overlapPrintedPages.length > 0) {
          this.bufferPrintedPages = this.overlapPrintedPages.slice();
        }
        this.overlapRemainder = "";
        this.overlapStartPage = null;
        this.overlapPrintedPages = [];
      }
    }

    const normalizedPrinted = normalizePrintedPage(printedPageNumber);
    if (
      normalizedPrinted &&
      this.bufferPrintedPages[this.bufferPrintedPages.length - 1] !==
        normalizedPrinted
    ) {
      this.bufferPrintedPages.push(normalizedPrinted);
    }

    this.bufferParts.push(text);
    this.bufferChars += text.length;
    this.bufferEndPage = pageNumber;
  }

  private tryMergeWithPrevious(
    content: string,
    tokenCount: number,
    section: string | null,
    startPage: number | null,
    endPage: number | null,
  ): boolean {
    if (tokenCount >= MIN_CHUNK_TOKENS || this.chunks.length === 0) return false;
    const prev = this.chunks[this.chunks.length - 1];
    const mergedTokens = prev.tokenCount + tokenCount;
    if (mergedTokens > SOFT_LIMIT_CHARS / 3 || prev.section !== section) return false;
    prev.content = `${prev.content}\n\n${content}`;
    prev.tokenCount = mergedTokens;
    const mergedPrintedPages = [...this.lastFlushedPrintedPages, ...this.bufferPrintedPages];
    prev.pageNumber = formatPrintedPageRange(mergedPrintedPages) ?? formatPrintedPageNumber(startPage, endPage);
    this.lastFlushedPrintedPages = mergedPrintedPages;
    this.clearBuffer();
    return true;
  }

  private extractOverlap(
    content: string,
    endPage: number | null,
  ): { content: string; tokenCount: number } {
    const tokenCount = estimateTokenCount(content);
    if (content.length <= CHUNK_OVERLAP_CHARS * 2) return { content, tokenCount };
    const overlapStart = findSentenceBoundary(content, content.length - CHUNK_OVERLAP_CHARS);
    const overlapText = content.slice(overlapStart).trim();
    if (overlapText.length <= 10) return { content, tokenCount };
    this.overlapRemainder = overlapText;
    this.overlapStartPage = endPage;
    this.overlapPrintedPages = this.bufferPrintedPages.slice(-1);
    const trimmed = content.slice(0, overlapStart).trim();
    return { content: trimmed, tokenCount: estimateTokenCount(trimmed) };
  }

  flush(): void {
    let content = this.bufferParts.join("\n\n").trim();
    const startPage = this.bufferStartPage;
    const endPage = this.bufferEndPage;
    const section = this.currentSection;
    const hierarchy = this.currentHierarchy;

    if (!content || content.length < 5 || isNoiseContent(content)) {
      this.clearBuffer();
      return;
    }

    const initialTokenCount = estimateTokenCount(content);
    if (this.tryMergeWithPrevious(content, initialTokenCount, section, startPage, endPage)) return;

    const overlapResult = this.extractOverlap(content, endPage);
    content = overlapResult.content;
    const tokenCount = overlapResult.tokenCount;

    const printedPages = this.bufferPrintedPages.slice();
    const pageNumber = formatPrintedPageRange(printedPages) ?? formatPrintedPageNumber(startPage, endPage);

    this.clearBuffer();
    this.lastFlushedPrintedPages = printedPages;

    this.chunks.push({
      chunkIndex: this.chunks.length,
      chunkType: inferChunkType(section, content),
      content,
      section,
      headerHierarchy: hierarchy,
      pageNumber,
      tokenCount,
    });
  }

  /**
   * Splits an oversized block into paragraph-aligned segments and emits each as its own chunk.
   *
   * @param content - The oversized block content.
   * @param pageNumber - The page the block belongs to.
   * @param printedPageNumber - Optional printed page number string.
   */
  private findSplitBoundary(text: string, size: number): number {
    const boundary = Math.max(
      text.lastIndexOf("\n\n", size),
      text.lastIndexOf(". ", size),
      text.lastIndexOf("; ", size),
      text.lastIndexOf(", ", size),
      text.lastIndexOf(" ", size),
    );
    return boundary > 0 ? boundary + 1 : size;
  }

  private emitChunkPart(
    part: string,
    pageNumber: number,
    printedPageNumber?: string | null,
  ): void {
    if (!part || part.length < 5 || isNoiseContent(part)) return;
    const normalizedPrinted = normalizePrintedPage(printedPageNumber);
    this.chunks.push({
      chunkIndex: this.chunks.length,
      chunkType: inferChunkType(this.currentSection, part),
      content: part,
      section: this.currentSection,
      headerHierarchy: this.currentHierarchy,
      pageNumber: normalizedPrinted
        ? `s. ${normalizedPrinted}`
        : formatPrintedPageNumber(pageNumber, pageNumber),
      tokenCount: estimateTokenCount(part),
    });
    this.lastFlushedPrintedPages = [normalizedPrinted ?? String(pageNumber)];
  }

  emitOversized(
    content: string,
    pageNumber: number,
    printedPageNumber?: string,
  ): void {
    let remainder = content.trim();
    let first = true;
    while (remainder.length > 0) {
      const take = first ? TARGET_CHUNK_SIZE_CHARS : TARGET_CHUNK_SIZE_CHARS - CHUNK_OVERLAP_CHARS;
      let size = Math.min(take, remainder.length);
      if (size < remainder.length) size = this.findSplitBoundary(remainder, size);
      const part = remainder.slice(0, size).trim();
      remainder = remainder.slice(size).trim();
      first = false;
      this.emitChunkPart(part, pageNumber, printedPageNumber);
    }
  }

  private clearBuffer(): void {
    this.bufferParts.length = 0;
    this.bufferStartPage = null;
    this.bufferEndPage = null;
    this.bufferChars = 0;
    this.bufferPrintedPages = [];
  }

  /**
   * Marks a new section boundary by updating header state and flushing pending content.
   *
   * @param block - The heading block that triggered the section change.
   */
  handleHeading(block: string): void {
    this.flush();
    this.headerState = updateHeaderState(this.headerState, block);
  }

  /**
   * Returns the processed chunks.
   *
   * @returns The array of processed document chunks.
   */
  get results(): DocumentChunk[] {
    return this.chunks;
  }
}

/**
 * Splits page markdown into RAG chunks that span both section and page boundaries.
 *
 * Section titles and page ranges persist across pages instead of resetting per page, so a multi-page chunk carries an accurate pageStart/pageEnd range and sections no longer lose their heading when they cross a page break. Chunks close at every heading and when a chunk exceeds the target size.
 *
 * Footnotes are included inside each page's markdownContent (as natural paragraphs) by the parser, so they flow through chunking as regular blocks.
 *
 * @param pages - PageAnalysis array from the Gemini PDF parser, containing pageNumber and markdownContent.
 * @returns Processed document chunks ready for embedding.
 */
export async function buildChunksFromPageAnalysis(
  pages: PageAnalysis[],
): Promise<DocumentChunk[]> {
  const builder = new ChunkBuilder();

  for (const page of pages) {
    const rawContent = normalizeAcademicText(page.markdownContent);
    const blocks = rawContent
      .split(/\n{2,}/)
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    for (const block of blocks) {
      const headingMatch = HEADING_RE.exec(block);
      if (headingMatch && isValidSectionHeader(headingMatch[2])) {
        builder.handleHeading(block);
        continue;
      }

      if (block.length > TARGET_CHUNK_SIZE_CHARS) {
        builder.emitOversized(block, page.pageNumber, page.printedPageNumber);
        continue;
      }

      builder.pushBlock(block, page.pageNumber, page.printedPageNumber);

      if (builder.bufferCharCount >= TARGET_CHUNK_SIZE_CHARS) {
        builder.flush();
      }
    }
  }

  builder.flush();

  // Filter out any remaining noise and drop REFERENCES (bibliography is preserved in sources.parsedReferences)
  const rawChunks = builder.results;
  const cleanChunks: DocumentChunk[] = [];
  for (const c of rawChunks) {
    if (!isNoiseContent(c.content) && c.chunkType !== "REFERENCES") {
      cleanChunks.push({
        ...c,
        chunkIndex: cleanChunks.length,
      });
    }
  }

  return cleanChunks;
}
