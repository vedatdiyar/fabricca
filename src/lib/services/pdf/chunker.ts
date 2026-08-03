import type { PageAnalysis } from "@/lib/services/pdf-parser/schema";

export interface DocumentChunk {
  chunkIndex: number;
  content: string;
  parentContent?: string;
  section: string | null;
  headerHierarchy: string[];
  pageStart: number | null;
  pageEnd: number | null;
  printedPageNumber: string | null;
  footnotes: string[];
  tokenCount: number;
}

const TARGET_CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

const HEADING_RE = /^(#{1,3})\s+(.+?)\s*$/;

interface HeaderState {
  h1: string | null;
  h2: string | null;
  h3: string | null;
}

const INITIAL_HEADER_STATE: HeaderState = { h1: null, h2: null, h3: null };

/**
 * Computes the printed page number display string for a chunk.
 *
 * @param pageStart - Start page number.
 * @param pageEnd - End page number.
 * @returns The formatted string (e.g. "s. 12" or "ss. 12-17").
 */
export function formatPrintedPageNumber(
  pageStart: number | null,
  pageEnd: number | null,
): string | null {
  if (pageStart === null) return null;
  if (pageEnd === null || pageStart === pageEnd) return `s. ${pageStart}`;
  return `ss. ${pageStart}-${pageEnd}`;
}

/**
 * Updates the header state when a markdown heading block is encountered.
 *
 * @param state - Current header state.
 * @param block - The markdown block to check.
 * @returns Updated header state.
 */
function updateHeaderState(state: HeaderState, block: string): HeaderState {
  const match = HEADING_RE.exec(block);
  if (!match) return state;

  const level = match[1].length;
  const title = match[2].slice(0, 120).trim();

  if (level === 1) return { h1: title, h2: null, h3: null };
  if (level === 2) return { ...state, h2: title, h3: null };
  return { ...state, h3: title };
}

/**
 * Builds the header hierarchy array from the current state.
 *
 * @param state - Current header state.
 * @returns Array of active heading titles from H1 down to the deepest level.
 */
function buildHeaderHierarchy(state: HeaderState): string[] {
  const hierarchy: string[] = [];
  if (state.h1) hierarchy.push(state.h1);
  if (state.h2) hierarchy.push(state.h2);
  if (state.h3) hierarchy.push(state.h3);
  return hierarchy;
}

/**
 * Returns the deepest section title from the header state.
 *
 * @param state - Current header state.
 * @returns The most specific section title, or null when no heading has been seen.
 */
function getSectionTitle(state: HeaderState): string | null {
  return state.h3 || state.h2 || state.h1 || null;
}

/**
 * Builds a runtime prefix containing page and section context for vector embedding and reranking.
 *
 * @param headerHierarchy - The heading hierarchy array.
 * @param section - The section title.
 * @param printedPageNumber - The formatted page number string.
 * @returns The context prefix string to prepend to the content.
 */
export function buildChunkContextPrefix(
  headerHierarchy: string[],
  section: string | null,
  printedPageNumber: string | null,
): string {
  const parts: string[] = [];
  if (headerHierarchy.length > 0) {
    parts.push(`[Bölüm: ${headerHierarchy.join(" > ")}]`);
  } else if (section) {
    parts.push(`[Bölüm: ${section}]`);
  }
  if (printedPageNumber) {
    parts.push(`[Sayfa: ${printedPageNumber}]`);
  }
  return parts.length > 0 ? `${parts.join(" ")}\n` : "";
}

/**
 * Builds the text to send to the embedding model — includes context prefix but preserves raw content separately.
 *
 * @param content - The raw chunk content.
 * @param headerHierarchy - The heading hierarchy array.
 * @param section - The section title.
 * @param printedPageNumber - The formatted page number string.
 * @returns The prefixed text for embedding.
 */
export function buildEmbeddingText(
  content: string,
  headerHierarchy: string[],
  section: string | null,
  printedPageNumber: string | null,
): string {
  const prefix = buildChunkContextPrefix(
    headerHierarchy,
    section,
    printedPageNumber,
  );
  return `${prefix}${content}`;
}

/**
 * Enriches chunks with a 3-chunk sliding window as parent context.
 *
 * @param chunks - Raw document chunks.
 * @returns Chunks enriched with parentContent.
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
 * Accumulates blocks into section-bounded chunks across page boundaries.
 */
class ChunkBuilder {
  private readonly chunks: DocumentChunk[] = [];
  private headerState: HeaderState = { ...INITIAL_HEADER_STATE };
  private readonly bufferParts: string[] = [];
  private bufferStartPage: number | null = null;
  private bufferEndPage: number | null = null;
  private bufferChars = 0;
  private bufferFootnotes: string[] = [];

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
   * Pushes a block onto the current buffer, tracking the page span and footnotes.
   *
   * @param text - The block text to buffer.
   * @param pageNumber - The page the block belongs to.
   * @param printedPageNumber - Optional printed page number string.
   * @param footnotes - Optional footnotes from the source page.
   */
  pushBlock(
    text: string,
    pageNumber: number,
    printedPageNumber?: string,
    footnotes?: string[],
  ): void {
    if (this.bufferStartPage === null) {
      this.bufferStartPage = pageNumber;
    }
    this.bufferParts.push(text);
    this.bufferChars += text.length;
    this.bufferEndPage = pageNumber;
    if (footnotes?.length) {
      this.bufferFootnotes.push(...footnotes);
    }
  }

  /** Finishes the current buffer and clears the accumulated state, pushing any meaningful content as a chunk. */
  flush(): void {
    const content = this.bufferParts.join("\n\n").trim();
    const footnotes = [...this.bufferFootnotes];
    const startPage = this.bufferStartPage;
    const endPage = this.bufferEndPage;
    const section = this.currentSection;
    const hierarchy = this.currentHierarchy;
    this.clearBuffer();

    if (!content || content.length < 5) return;

    this.chunks.push({
      chunkIndex: this.chunks.length,
      content,
      section,
      headerHierarchy: hierarchy,
      pageStart: startPage,
      pageEnd: endPage,
      printedPageNumber: formatPrintedPageNumber(startPage, endPage),
      footnotes,
      tokenCount: Math.ceil(content.length / 4),
    });
  }

  /**
   * Splits an oversized block into paragraph-aligned segments and emits each as its own chunk.
   *
   * @param content - The oversized block content.
   * @param pageNumber - The page the block belongs to.
   * @param printedPageNumber - Optional printed page number string.
   * @param footnotes - Optional footnotes from the source page.
   */
  emitOversized(
    content: string,
    pageNumber: number,
    printedPageNumber?: string,
    footnotes?: string[],
  ): void {
    let remainder = content.trim();
    let first = true;
    while (remainder.length > 0) {
      const take = first
        ? TARGET_CHUNK_SIZE
        : TARGET_CHUNK_SIZE - CHUNK_OVERLAP;
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

      if (!part || part.length < 5) continue;

      this.chunks.push({
        chunkIndex: this.chunks.length,
        content: part,
        section: this.currentSection,
        headerHierarchy: this.currentHierarchy,
        pageStart: pageNumber,
        pageEnd: pageNumber,
        printedPageNumber:
          printedPageNumber ?? formatPrintedPageNumber(pageNumber, pageNumber),
        footnotes: footnotes ?? [],
        tokenCount: Math.ceil(part.length / 4),
      });
    }
  }

  /** Clears the current accumulation state. */
  private clearBuffer(): void {
    this.bufferParts.length = 0;
    this.bufferStartPage = null;
    this.bufferEndPage = null;
    this.bufferChars = 0;
    this.bufferFootnotes.length = 0;
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
 * @param pages - PageAnalysis array from the Gemini PDF parser, containing pageNumber, markdownContent, and footnotes.
 * @returns Processed document chunks ready for embedding.
 */
export async function buildChunksFromPageAnalysis(
  pages: PageAnalysis[],
): Promise<DocumentChunk[]> {
  const builder = new ChunkBuilder();

  for (const page of pages) {
    const blocks = page.markdownContent
      .split(/\n{2,}/)
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    for (const block of blocks) {
      const headingMatch = HEADING_RE.exec(block);
      if (headingMatch) {
        builder.handleHeading(block);
        builder.pushBlock(
          block,
          page.pageNumber,
          page.printedPageNumber,
          page.footnotes ?? [],
        );
        continue;
      }

      if (block.length > TARGET_CHUNK_SIZE) {
        builder.emitOversized(
          block,
          page.pageNumber,
          page.printedPageNumber,
          page.footnotes ?? [],
        );
        continue;
      }

      builder.pushBlock(
        block,
        page.pageNumber,
        page.printedPageNumber,
        page.footnotes ?? [],
      );

      if (builder.bufferCharCount >= TARGET_CHUNK_SIZE) {
        builder.flush();
      }
    }
  }

  builder.flush();

  return applyParentChildContext(builder.results);
}
