import { createHash } from "crypto";

export interface ChunkMetadata {
  pageNumber?: number | null;
  printedPageNumber?: number | null;
  sectionTitle?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  headerHierarchy?: string[];
  [key: string]: unknown;
}

export interface DocumentChunk {
  chunkIndex: number;
  content: string;
  parentContent?: string;
  section: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  contentHash: string;
  metadata: ChunkMetadata;
  tokenCount: number;
}

const TARGET_CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

/** Level-1 / level-2 markdown heading — hard section boundary. */
const SECTION_HEADING_RE = /^(#{1,2})\s+(.+?)\s*$/;

/**
 * Computes a stable SHA-256 content fingerprint for a chunk.
 *
 * @param content - The chunk content to fingerprint.
 * @returns The hex SHA-256 digest.
 */
function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Builds a runtime prefix containing page and section context for vector embedding and reranking.
 *
 * @param metadata - The chunk's metadata object.
 * @returns The context prefix string to prepend to the content.
 */
export function buildChunkContextPrefix(metadata: ChunkMetadata): string {
  const parts: string[] = [];
  if (metadata.sectionTitle) {
    parts.push(`[Bölüm: ${metadata.sectionTitle}]`);
  }
  if (metadata.pageNumber) {
    parts.push(`[Sayfa: ${metadata.pageNumber}]`);
  }
  return parts.length > 0 ? `${parts.join(" ")}\n` : "";
}

/**
 * Detects and extracts bibliography / references section from markdown text.
 *
 * @param fullMarkdown - Full document markdown text.
 * @returns Object with mainBody markdown and optional rawReferences text.
 */
export function extractReferencesFromMarkdown(fullMarkdown: string): {
  mainBody: string;
  rawReferences: string | null;
} {
  const refPattern =
    /\n(?=(?:#{1,4}\s+)?(?:KAYNAKÇA|KAYNAKLAR|REFERENCES|BIBLIOGRAPHY|KAYNAK DİZİNİ)\b)/i;
  const match = fullMarkdown.match(refPattern);

  if (!match || match.index === undefined) {
    return { mainBody: fullMarkdown, rawReferences: null };
  }

  const mainBody = fullMarkdown.slice(0, match.index).trim();
  const rawReferences = fullMarkdown
    .slice(match.index)
    .replace(/--- PAGE_MARKER_\d+ ---\n?/g, "")
    .trim();

  return {
    mainBody,
    rawReferences: rawReferences.length > 0 ? rawReferences : null,
  };
}

/**
 * Checks whether a chunk string is trivial noise (formatting lines, junk symbols).
 *
 * @param content - Chunk content string.
 * @returns True if noise.
 */
export function isNoiseChunk(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length < 5 && !/[\p{L}0-9]/u.test(trimmed)) return true;
  if (/^[*\-_\s]{3,}$/.test(trimmed)) return true;
  return false;
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
 * Builder that accumulates blocks into section-bounded chunks across page boundaries.
 */
class ChunkBuilder {
  private readonly chunks: DocumentChunk[] = [];
  private section: string | null = null;
  private readonly bufferParts: string[] = [];
  private bufferStartPage: number | null = null;
  private bufferEndPage: number | null = null;
  private bufferChars = 0;

  /**
   * Reports the current accumulated character count of the in-progress buffer.
   *
   * @returns The number of buffered characters.
   */
  get bufferCharCount(): number {
    return this.bufferChars;
  }

  /**
   * Pushes a block onto the current buffer, tracking the page span.
   *
   * @param text - The block text to buffer.
   * @param pageNumber - The page the block belongs to.
   */
  pushBlock(text: string, pageNumber: number): void {
    if (this.bufferStartPage === null) {
      this.bufferStartPage = pageNumber;
    }
    this.bufferParts.push(text);
    this.bufferChars += text.length;
    this.bufferEndPage = pageNumber;
  }

  /** Finishes the current buffer and clears the accumulated state, pushing any meaningful content as a chunk. */
  flush(): void {
    const content = this.bufferParts.join("\n\n").trim();
    this.clearBuffer();

    if (!content || isNoiseChunk(content)) return;

    this.chunks.push({
      chunkIndex: this.chunks.length,
      content,
      section: this.section,
      pageStart: this.bufferStartPage,
      pageEnd: this.bufferEndPage,
      contentHash: contentHash(content),
      metadata: {
        pageNumber: this.bufferStartPage,
        printedPageNumber: this.bufferStartPage,
        sectionTitle: this.section,
        pageStart: this.bufferStartPage,
        pageEnd: this.bufferEndPage,
      },
      tokenCount: Math.ceil(content.length / 4),
    });
  }

  /**
   * Splits an oversized block into paragraph-aligned segments and emits each as its own chunk, keeping a small overlap.
   *
   * @param content - The oversized block content.
   * @param pageNumber - The page the block belongs to.
   */
  emitOversized(content: string, pageNumber: number): void {
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

      if (!part || isNoiseChunk(part)) continue;

      this.chunks.push({
        chunkIndex: this.chunks.length,
        content: part,
        section: this.section,
        pageStart: pageNumber,
        pageEnd: pageNumber,
        contentHash: contentHash(part),
        metadata: {
          pageNumber,
          printedPageNumber: pageNumber,
          sectionTitle: this.section,
          pageStart: pageNumber,
          pageEnd: pageNumber,
        },
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
  }

  /**
   * Marks a new section boundary and flushes any pending content.
   *
   * @param title - The normalized section title to begin.
   */
  startSection(title: string): void {
    this.flush();
    this.section = title;
  }

  get results(): DocumentChunk[] {
    return this.chunks;
  }
}

/**
 * Splits page markdown into RAG chunks that span both section and page boundaries.
 *
 * Section titles and page ranges persist across pages instead of resetting per page, so a multi-page chunk carries an accurate pageStart/pageEnd range and sections no longer lose their heading when they cross a page break. Chunks close at every level-1/2 heading and when a chunk exceeds the target size; each chunk receives a stable SHA-256 hash.
 *
 * @param pages - Array of page number and page markdown pairs, in document order.
 * @returns Processed document chunks ready for embedding.
 */
export async function buildChunksFromPageMarkdown(
  pages: Array<{ pageNumber: number; text: string }>,
): Promise<DocumentChunk[]> {
  const builder = new ChunkBuilder();

  for (const page of pages) {
    const blocks = page.text
      .split(/\n{2,}/)
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    for (const block of blocks) {
      if (isNoiseChunk(block)) continue;

      const headingMatch = SECTION_HEADING_RE.exec(block);
      if (headingMatch) {
        const title = headingMatch[2].slice(0, 120).trim();
        if (/^(index|dizin)(\s+|$)/i.test(title)) {
          builder.flush();
          continue;
        }
        builder.startSection(title);
        builder.pushBlock(block, page.pageNumber);
        continue;
      }

      if (block.length > TARGET_CHUNK_SIZE) {
        builder.emitOversized(block, page.pageNumber);
        continue;
      }

      builder.pushBlock(block, page.pageNumber);

      if (builder.bufferCharCount >= TARGET_CHUNK_SIZE) {
        builder.flush();
      }
    }
  }

  builder.flush();

  return applyParentChildContext(builder.results);
}
