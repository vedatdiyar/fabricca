import type { DocumentChunk } from "./chunker";

/**
 * Legacy pass-through: Dynamic context is now handled at retrieval time.
 *
 * @param chunks - Raw document chunks.
 * @returns Chunks directly.
 */
export function applyParentChildContext(
  chunks: DocumentChunk[],
): DocumentChunk[] {
  return chunks;
}
