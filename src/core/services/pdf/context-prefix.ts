/**
 * Builds a runtime prefix containing page and section context for vector embedding and reranking.
 *
 * @param headerHierarchy - The heading hierarchy array.
 * @param section - The section title.
 * @param pageNumber - The formatted page number string.
 * @returns The context prefix string to prepend to the content.
 */
export function buildChunkContextPrefix(
  headerHierarchy: string[],
  section: string | null,
  pageNumber: string | null,
): string {
  const parts: string[] = [];
  if (headerHierarchy.length > 0) {
    parts.push(`[Bölüm: ${headerHierarchy.join(" > ")}]`);
  } else if (section) {
    parts.push(`[Bölüm: ${section}]`);
  }
  if (pageNumber) {
    parts.push(`[Sayfa: ${pageNumber}]`);
  }
  return parts.length > 0 ? `${parts.join(" ")}\n` : "";
}

/**
 * Builds the text to send to the embedding model — includes context prefix but preserves raw content separately.
 *
 * @param content - The raw chunk content.
 * @param headerHierarchy - The heading hierarchy array.
 * @param section - The section title.
 * @param pageNumber - The formatted page number string.
 * @returns The prefixed text for embedding.
 */
export function buildEmbeddingText(
  content: string,
  headerHierarchy: string[],
  section: string | null,
  pageNumber: string | null,
): string {
  const prefix = buildChunkContextPrefix(
    headerHierarchy,
    section,
    pageNumber,
  );
  return `${prefix}${content}`;
}
