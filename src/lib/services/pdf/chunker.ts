import {
  MarkdownTextSplitter,
  RecursiveCharacterTextSplitter,
} from "@langchain/textsplitters";

export interface ChunkMetadata {
  pageNumber?: number | null;
  printedPageNumber?: number | null;
  sectionTitle?: string | null;
  headerHierarchy?: string[];
  [key: string]: unknown;
}

export interface DocumentChunk {
  chunkIndex: number;
  content: string;
  parentContent?: string;
  metadata: ChunkMetadata;
  tokenCount: number;
}

const TARGET_CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

const markdownSplitter = new MarkdownTextSplitter({
  chunkSize: TARGET_CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
});

const recursiveSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: TARGET_CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
  separators: ["\n\n", "\n", ". ", "? ", "! ", " ", ""],
});

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
 * Enriches chunks with 3-chunk window parent context.
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
 * Splits page markdown list into RAG document chunks using LangChain Markdown & Recursive Splitters.
 *
 * @param pages - Array of page number and page markdown text pairs.
 * @returns Processed document chunks ready for embedding.
 */
export async function buildChunksFromPageMarkdown(
  pages: Array<{ pageNumber: number; text: string }>,
): Promise<DocumentChunk[]> {
  const rawChunks: DocumentChunk[] = [];
  let chunkIdx = 0;

  for (const page of pages) {
    const rawText = page.text.trim();
    if (!rawText) continue;

    const subBlocks = await markdownSplitter.splitText(rawText);
    let currentSectionTitle: string | null = null;

    for (const block of subBlocks) {
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

      if (cleanBlock.length > TARGET_CHUNK_SIZE) {
        const subTexts = await recursiveSplitter.splitText(cleanBlock);
        for (const subText of subTexts) {
          const clean = subText.trim();
          if (clean && !isNoiseChunk(clean)) {
            rawChunks.push({
              chunkIndex: chunkIdx++,
              content: clean,
              metadata: {
                pageNumber: page.pageNumber,
                printedPageNumber: page.pageNumber,
                sectionTitle: currentSectionTitle,
              },
              tokenCount: Math.ceil(clean.length / 4),
            });
          }
        }
      } else {
        rawChunks.push({
          chunkIndex: chunkIdx++,
          content: cleanBlock,
          metadata: {
            pageNumber: page.pageNumber,
            printedPageNumber: page.pageNumber,
            sectionTitle: currentSectionTitle,
          },
          tokenCount: Math.ceil(cleanBlock.length / 4),
        });
      }
    }
  }

  return applyParentChildContext(rawChunks);
}
