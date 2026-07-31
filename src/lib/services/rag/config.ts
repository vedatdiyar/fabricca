/**
 * Hybrid RAG pipeline configuration.
 *
 * Constants controlling the retrieval layer of the RAG system:
 * dense (pgvector HNSW) + lexical (PostgreSQL FTS) candidate counts,
 * RRF fusion constant and the reranker candidate pool size.
 */
export const RAG_CONFIG = {
  /** Number of dense candidates fetched from pgvector before fusion. */
  denseTopK: 30,
  /** Number of lexical candidates fetched from PostgreSQL FTS before fusion. */
  lexicalTopK: 30,
  /** Reciprocal Rank Fusion constant `k` (higher → more forgiving to low ranks). */
  rrfK: 60,
  /** Top-N candidates (after RRF sorting) handed to the Cohere reranker. */
  rerankCandidatePool: 30,
  /** Default final result count returned to the caller. */
  finalTopK: 5,
  /** Maximum number of tokens AND-ed into a single FTS query (keeps queries precise). */
  lexicalMaxQueryTokens: 8,
} as const;
