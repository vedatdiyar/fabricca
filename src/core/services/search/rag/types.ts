import type { Logger } from "@/lib/logger";
import type { RrfScoredCandidate } from "./rrf";

/** Per-candidate retrieval debug metadata (only exposed when `debug: true`). */
export interface RagSearchDebug {
  denseRank?: number;
  lexicalRank?: number;
  rrfScore: number;
  rerankScore: number;
  denseScore: number;
}

/** Final RAG result item with source metadata, content, and parent-child context. */
export interface RagSearchResultItem {
  resourceId: number;
  resourceTitle: string;
  resourceAuthors: string[];
  resourceYear: number | null;
  chunkIndex: number;
  pageNumber: string | null;
  sectionTitle: string | null;
  content: string;
  parentContent: string;
  relevanceScore: number;
  denseScore: number;
  /** When true, this chunk did not pass the dual-score gate but was included as the closest partial match (0-chunk fallback). */
  isPartialMatch: boolean;
  /** Retrieval provenance — only present when `options.debug` is enabled. */
  debug?: RagSearchDebug;
}

/** Hybrid RAG search options: query, optional resource filter, topK, and debug provenance. */
export interface RagSearchOptions {
  query: string;
  resourceIds?: number[];
  topK?: number;
  logger?: Logger;
  /** When true, attaches per-candidate retrieval provenance (`denseRank`, `lexicalRank`, `rrfScore`, `rerankScore`). */
  debug?: boolean;
}

/** Dense branch candidate merged with the source metadata needed for assembly. */
export interface DenseCandidate {
  id: number;
  resourceId: number;
  chunkIndex: number;
  content: string;
  section: string | null;
  headerHierarchy: string[] | null;
  pageNumber: string | null;
  title: string;
  authors: string[] | null;
  publicationYear: number | null;
  embedding: number[];
}

export interface RankedEntry {
  rrf: RrfScoredCandidate;
  relevanceScore: number;
  rerankScore: number;
  denseScore: number;
}
