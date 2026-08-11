import type { PageAnalysis } from "@/lib/services/pdf-parser/schema";
import { normalizeAcademicText } from "@/lib/services/pdf/normalizer";

export interface DocumentChunk {
  chunkIndex: number;
  content: string;
  parentContent?: string;
  section: string | null;
  headerHierarchy: string[];
  pageStart: number | null;
  pageEnd: number | null;
  printedPageNumber: string | null;
  tokenCount: number;
}

const TARGET_CHUNK_SIZE_CHARS = 1200;
const CHUNK_OVERLAP_CHARS = 200;
const SOFT_LIMIT_CHARS = 1400;
const MIN_CHUNK_TOKENS = 100;

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

/** Strips the "s."/"ss." prefix and trailing dots from a parsed printed page token. */
const PRINTED_PREFIX_RE = /^s{1,2}\.\s*/i;

/**
 * Normalizes a raw printed page number from the PDF parser into a usable token.
 *
 * @param printedPageNumber - The parser's raw printed page number, or null.
 * @returns The trimmed page token without the "s."/"ss." prefix, or null when absent.
 */
function normalizePrintedPage(
  printedPageNumber: string | null | undefined,
): string | null {
  if (!printedPageNumber) return null;
  const trimmed = printedPageNumber
    .trim()
    .replace(/\.+$/g, "")
    .replace(PRINTED_PREFIX_RE, "")
    .trim();
  return trimmed || null;
}

/**
 * Renders a printed page range from the ordered page tokens seen in a chunk,
 * preserving the actual published journal page numbers (e.g. "ss. 119-151").
 *
 * @param printedPages - Ordered printed page tokens.
 * @returns The formatted string ("s. X" / "ss. X-Y"), or null when no token exists.
 */
function formatPrintedPageRange(printedPages: string[]): string | null {
  const pages = printedPages.filter((p) => p.length > 0);
  if (pages.length === 0) return null;
  const start = pages[0];
  const end = pages[pages.length - 1];
  return start === end ? `s. ${start}` : `ss. ${start}-${end}`;
}

/**
 * Validates whether a markdown heading candidate is a legitimate academic section header
 * rather than layout noise (e.g. "İdaresi", "Antalya, 2014", standalone page numbers, or short words).
 *
 * @param title - The candidate header title string.
 * @returns True if the title appears to be a valid section header.
 */
export function isValidSectionHeader(title: string): boolean {
  if (!title) return false;
  const trimmed = title.trim();

  // 1. Minimum length requirement: must be at least 3 characters
  if (trimmed.length < 3) return false;

  // 2. Reject metadata, dates, city tags, or page number artifacts (e.g., "Antalya, 2014", "Sayfa 12", "s. 45")
  if (
    /^(Antalya|Ankara|İstanbul|İzmir|Erzurum|Diyarbakır|Konya|Sivas|Trabzon|Adana)[,\s]+\d{4}$/i.test(
      trimmed,
    ) ||
    /^(Sayfa|s\.|ss\.|Page)\s*\d+$/i.test(trimmed) ||
    /^(Yüksek Lisans|Doktora)\s+Tezi$/i.test(trimmed) ||
    /^(Ana Bilim Dalı|Enstitüsü|Fakültesi|Üniversitesi)$/i.test(trimmed)
  ) {
    return false;
  }

  // 3. Always accept numbered section titles (e.g. "1.", "1.2.", "1.2.1.", "A.", "B.", "III.")
  if (/^(\d+(\.\d+)*\.?|[A-Z]\.|[IVXLCDM]+\.)\s+/i.test(trimmed)) {
    return true;
  }

  // 4. Always accept standard major academic headings
  if (
    /^(GİRİŞ|SONUÇ|KAYNAKÇA|KAYNAKLAR|REFERANSLAR|ATIFLAR|ÖZET|ABSTRACT|ÖNSÖZ|İÇİNDEKİLER|BÖLÜM\s+\d+|GİRİŞ VE AMAÇ|METODOLOJİ|BULGULAR|TARTIŞMA|REFERENCES|BIBLIOGRAPHY|INTRODUCTION|CONCLUSION)\b/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  // 5. For non-numbered, non-standard titles: reject single isolated common words (like "İdaresi", "Yapısı", "Hakkında", "Ayrıca")
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount === 1) {
    // Single word titles are only valid if > 12 characters or uppercase major section
    if (trimmed.length <= 12 && !/^[A-ZÇĞİÖŞÜ]{4,}$/.test(trimmed)) {
      return false;
    }
  }

  return true;
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

  if (!isValidSectionHeader(title)) return state;

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
 * Estimates token count for Turkish/multilingual text using BGE-M3's
 * SentencePiece tokenizer ratio (~3 chars/token).
 *
 * @param text - The text to estimate token count for.
 * @returns Estimated token count.
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 3);
}

/**
 * Finds the nearest sentence boundary (. ? ! \n\n) scanning backwards
 * from the given position for clean overlap transitions.
 *
 * @param text - The full buffer text.
 * @param fromPos - Position to scan backwards from.
 * @returns The position where the overlap should start.
 */
function findSentenceBoundary(text: string, fromPos: number): number {
  const boundaries = [". ", "? ", "! ", "\n\n"];
  let bestPos = -1;
  let bestLen = 0;
  for (const b of boundaries) {
    const pos = text.lastIndexOf(b, fromPos);
    if (pos > bestPos && pos > 0) {
      bestPos = pos;
      bestLen = b.length;
    }
  }
  return bestPos > 0 ? bestPos + bestLen : Math.max(0, fromPos);
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

    if (!content || content.length < 5) {
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
        prev.pageEnd = endPage;
        const mergedPrintedPages = [
          ...this.lastFlushedPrintedPages,
          ...this.bufferPrintedPages,
        ];
        prev.printedPageNumber =
          formatPrintedPageRange(mergedPrintedPages) ??
          formatPrintedPageNumber(prev.pageStart, endPage);
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
    const printedPageNumber =
      formatPrintedPageRange(printedPages) ??
      formatPrintedPageNumber(startPage, endPage);

    this.clearBuffer();
    this.lastFlushedPrintedPages = printedPages;

    this.chunks.push({
      chunkIndex: this.chunks.length,
      content,
      section,
      headerHierarchy: hierarchy,
      pageStart: startPage,
      pageEnd: endPage,
      printedPageNumber,
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
        tokenCount: estimateTokenCount(part),
      });
      this.lastFlushedPrintedPages = [
        normalizePrintedPage(printedPageNumber) ?? String(pageNumber),
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

  return applyParentChildContext(builder.results);
}
