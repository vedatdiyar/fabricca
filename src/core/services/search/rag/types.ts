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
  /** Topic box type (e.g. PRIMARY_MATERIAL, THEORETICAL_FRAMEWORK, SUBJECT_PROBLEM). */
  boxType?: string | null;
  /** True when the chunk originates from primary empirical research material. */
  isPrimaryMaterial?: boolean;
  /** When true, this chunk did not pass the dual-score gate but was included as the closest partial match (0-chunk fallback). */
  isPartialMatch: boolean;
  /** Retrieval provenance — only present when `options.debug` is enabled. */
  debug?: RagSearchDebug;
}

/** Box-type partition for bimodal RAG retrieval (primary empirical material vs. secondary literature). */
export type BoxTypeFilter = "PRIMARY_MATERIAL_ONLY" | "SECONDARY_LITERATURE_ONLY";

/** Hybrid RAG search options: query, optional resource filter, topK, and debug provenance. */
export interface RagSearchOptions {
  query: string;
  resourceIds?: number[];
  topK?: number;
  logger?: Logger;
  /** When true, attaches per-candidate retrieval provenance (`denseRank`, `lexicalRank`, `rrfScore`, `rerankScore`). */
  debug?: boolean;
  /** Restricts retrieval to a box-type partition; omitted means all boxes (except RELATED_THESES). */
  boxTypeFilter?: BoxTypeFilter;
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
  boxType?: string | null;
  embedding: number[];
}

export interface RankedEntry {
  rrf: RrfScoredCandidate;
  relevanceScore: number;
  rerankScore: number;
  denseScore: number;
}
