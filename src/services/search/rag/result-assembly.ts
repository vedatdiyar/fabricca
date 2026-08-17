import type { Logger } from "@/lib/logger";
import { formatResourceAuthors } from "@/lib/academic/author-formatter";
import type {
  RagSearchResultItem,
  RagSearchDebug,
  RankedEntry,
  DenseCandidate,
} from "./types";
import type { LexicalCandidate } from "./lexical";

export interface ResultAssemblyParams {
  candidateMap: Map<number, DenseCandidate | LexicalCandidate>;
  rankedPool: RankedEntry[];
  filtered: RankedEntry[];
  topK: number;
  debug?: boolean;
  logger?: Logger;
}

/**
 * Assembles final RagSearchResultItem DTOs from ranked/filtered pool, falling back to top partial matches when needed.
 *
 * @param params - Candidates map, ranked pool, filter matches, topK, debug flag, and logger.
 * @returns Final RagSearchResultItem array.
 */
export function assembleRagResults(
  params: ResultAssemblyParams,
): RagSearchResultItem[] {
  const { candidateMap, rankedPool, filtered, topK, debug, logger } = params;

  const toResultItems = (
    entries: RankedEntry[],
    partial: boolean,
  ): RagSearchResultItem[] =>
    entries.map(({ rrf, relevanceScore, rerankScore, denseScore }) => {
      const candidate = candidateMap.get(rrf.id)!;
      const debugMeta: RagSearchDebug | undefined = debug
        ? {
            denseRank: rrf.denseRank,
            lexicalRank: rrf.lexicalRank,
            rrfScore: rrf.rrfScore,
            rerankScore,
            denseScore,
          }
        : undefined;

      return {
        resourceId: candidate.resourceId,
        resourceTitle: candidate.title,
        resourceAuthors: formatResourceAuthors({
          authors: candidate.authors,
        }),
        resourceYear: candidate.publicationYear ?? null,
        chunkIndex: candidate.chunkIndex,
        printedPageNumber: candidate.printedPageNumber,
        pageStart: candidate.pageStart,
        pageEnd: candidate.pageEnd,
        sectionTitle: candidate.section ?? null,
        content: candidate.content,
        parentContent: candidate.parentContent || candidate.content,
        relevanceScore,
        denseScore,
        isPartialMatch: partial,
        ...(debugMeta ? { debug: debugMeta } : {}),
      };
    });

  if (filtered.length > 0) {
    return toResultItems(filtered.slice(0, topK), false);
  }

  const fallback = rankedPool
    .slice()
    .sort((a, b) => b.rerankScore - a.rerankScore)
    .slice(0, 2);

  const fallbackResults = toResultItems(fallback, true);

  logger?.info("rag_dual_score_fallback_partial", {
    service: "rag-search",
    data: {
      fallbackCount: fallbackResults.length,
      topRerankScore: fallback[0]?.rerankScore ?? 0,
    },
  });

  return fallbackResults;
}
