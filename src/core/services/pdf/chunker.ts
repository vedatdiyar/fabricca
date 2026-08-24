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

export type ChunkType =
  | "TITLE_ABSTRACT"
  | "BODY"
  | "METHODOLOGY"
  | "FINDINGS"
  | "FOOTNOTE"
  | "ENDNOTES"
  | "REFERENCES"
  | "AUTHOR_BIO";

export interface DocumentChunk {
  chunkIndex: number;
  chunkType: ChunkType;
  content: string;
  section: string | null;
  headerHierarchy: string[];
  pageNumber: string | null;
  tokenCount: number;
}

/**
 * Detects whether a text block is pure image noise or uninformative micro-content.
 *
 * @param text - The chunk text to inspect.
 * @returns True when the content should be dropped from vector and RAG ingestion.
 */
export function isNoiseContent(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 25) return true;
  // If it only contains a markdown image tag like ![img-0.jpeg](img-0.jpeg)
  if (/^!\[.*?\]\(.*?\)$/i.test(trimmed)) return true;
  return false;
}

/**
 * Classifies section heading and content into semantic ChunkType.
 *
 * @param sectionTitle - The active section heading.
 * @param content - The chunk body content.
 * @returns Inferred ChunkType enum value.
 */
export function inferChunkType(
  sectionTitle: string | null,
  content: string,
): ChunkType {
  // 1. Abstract/Özet detection (check section title or chunk content prefix)
  if (
    (sectionTitle && /abstract|özet|öz\b/i.test(sectionTitle)) ||
    /(^|\n)\s*(abstract|öz|özet)\b/i.test(content.slice(0, 300))
  ) {
    return "TITLE_ABSTRACT";
  }

  if (!sectionTitle) {
    return "BODY";
  }

  const s = sectionTitle.toLowerCase();
  if (
    /notes\s+on\s+contributor|about\s+the\s+author|orcid|author\s+bio|biography|disclosure\s+statement|disclosure|conflict\s+of\s+interest|acknowledgements|teşekkür/i.test(
      s,
    )
  ) {
    return "AUTHOR_BIO";
  }
  if (
    /references|kaynakça|kaynaklar|bibliography|works\s+cited|literature\s+cited|quellen/i.test(
      s,
    )
  ) {
    return "REFERENCES";
  }
  if (/notes|endnotes|footnotes|dipnotlar|notlar/i.test(s)) {
    return "ENDNOTES";
  }
  if (
    /methodology|methods?|yöntem|metodoloji|metod|materials?\s+and\s+methods/i.test(
      s,
    )
  ) {
    return "METHODOLOGY";
  }
  if (/findings|results|bulgular|sonuçlar\s+ve\s+tartışma/i.test(s)) {
    return "FINDINGS";
  }
  return "BODY";
}

// Re-export helper functions for backwards compatibility & direct use
export {
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

    let tokenCount = estimateTokenCount(content);

    if (tokenCount < MIN_CHUNK_TOKENS && this.chunks.length > 0) {
      const prev = this.chunks[this.chunks.length - 1];
      const mergedTokens = prev.tokenCount + tokenCount;

      if (mergedTokens <= SOFT_LIMIT_CHARS / 3 && prev.section === section) {
        prev.content = `${prev.content}\n\n${content}`;
        prev.tokenCount = mergedTokens;
        const mergedPrintedPages = [
          ...this.lastFlushedPrintedPages,
          ...this.bufferPrintedPages,
        ];
        prev.pageNumber =
          formatPrintedPageRange(mergedPrintedPages) ??
          formatPrintedPageNumber(startPage, endPage);
        this.lastFlushedPrintedPages = mergedPrintedPages;
        this.clearBuffer();
        return;
      }
    }

    const overlapCharTarget = CHUNK_OVERLAP_CHARS;

    if (content.length > overlapCharTarget * 2) {
      const overlapStart = findSentenceBoundary(
        content,
        content.length - overlapCharTarget,
      );
      const overlapText = content.slice(overlapStart).trim();

      if (overlapText.length > 10) {
        this.overlapRemainder = overlapText;
        this.overlapStartPage = endPage;
        this.overlapPrintedPages = this.bufferPrintedPages.slice(-1);

        content = content.slice(0, overlapStart).trim();
        tokenCount = estimateTokenCount(content);
      }
    }

    const printedPages = this.bufferPrintedPages.slice();
    const pageNumber =
      formatPrintedPageRange(printedPages) ??
      formatPrintedPageNumber(startPage, endPage);

    this.clearBuffer();
    this.lastFlushedPrintedPages = printedPages;

    const chunkType = inferChunkType(section, content);

    this.chunks.push({
      chunkIndex: this.chunks.length,
      chunkType,
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
  emitOversized(
    content: string,
    pageNumber: number,
    printedPageNumber?: string,
  ): void {
    let remainder = content.trim();
    let first = true;
    while (remainder.length > 0) {
      const take = first
        ? TARGET_CHUNK_SIZE_CHARS
        : TARGET_CHUNK_SIZE_CHARS - CHUNK_OVERLAP_CHARS;
      let size = Math.min(take, remainder.length);
      if (size < remainder.length) {
        const boundary = Math.max(
          remainder.lastIndexOf("\n\n", size),
          remainder.lastIndexOf(". ", size),
          remainder.lastIndexOf("; ", size),
          remainder.lastIndexOf(", ", size),
          remainder.lastIndexOf(" ", size),
        );
        if (boundary > 0) size = boundary + 1;
      }

      const part = remainder.slice(0, size).trim();
      remainder = remainder.slice(size).trim();
      first = false;

      if (!part || part.length < 5 || isNoiseContent(part)) continue;

      const chunkType = inferChunkType(this.currentSection, part);

      const normalizedPrinted = normalizePrintedPage(printedPageNumber);
      this.chunks.push({
        chunkIndex: this.chunks.length,
        chunkType,
        content: part,
        section: this.currentSection,
        headerHierarchy: this.currentHierarchy,
        pageNumber: normalizedPrinted
          ? `s. ${normalizedPrinted}`
          : formatPrintedPageNumber(pageNumber, pageNumber),
        tokenCount: estimateTokenCount(part),
      });
      this.lastFlushedPrintedPages = [
        normalizedPrinted ?? String(pageNumber),
      ];
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
