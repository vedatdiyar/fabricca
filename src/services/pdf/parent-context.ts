import type { DocumentChunk } from "./chunker";

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
