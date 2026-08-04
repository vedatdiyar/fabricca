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
  /** Minimum Cohere rerank score (primary gate). Empirical test: relevant queries scored 0.877–0.975, partially-relevant 0.605–0.712; 0.80 sits in the gap. */
  rerankScoreThreshold: 0.8,
  /** Minimum dense (cosine similarity) score (safety net). Irrelevant queries scored 0.32–0.40, relevant ≥ 0.45. Kept low because it only guards against Cohere false positives (e.g. a fully irrelevant chunk received Cohere 1.00 while dense was correctly 0.33). */
  denseScoreThreshold: 0.45,
} as const;
