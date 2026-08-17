/**
 * Estimates token count for Turkish/multilingual text using BGE-M3's
 * SentencePiece tokenizer ratio (~3 chars/token).
 *
 * @param text - The text to estimate token count for.
 * @returns Estimated token count.
 */
export function estimateTokenCount(text: string): number {
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
export function findSentenceBoundary(text: string, fromPos: number): number {
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
