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
