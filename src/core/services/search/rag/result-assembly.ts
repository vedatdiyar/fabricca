import type { Logger } from "@/lib/logger";
import { formatResourceAuthors } from "@/lib/academic/author-formatter";
import type {
  RagSearchResultItem,
  RagSearchDebug,
  RankedEntry,
  DenseCandidate,
} from "./types";
import type { LexicalCandidate } from "./lexical";
import { fetchDynamicContextWindows } from "./dynamic-context";

export interface ResultAssemblyParams {
  candidateMap: Map<number, DenseCandidate | LexicalCandidate>;
  rankedPool: RankedEntry[];
  filtered: RankedEntry[];
  topK: number;
  debug?: boolean;
  logger?: Logger;
}

/**
 * Assembles final RagSearchResultItem DTOs from ranked/filtered pool, dynamically fetching surrounding context window.
 *
 * @param params - Candidates map, ranked pool, filter matches, topK, debug flag, and logger.
 * @returns Final RagSearchResultItem array.
 */
export async function assembleRagResults(
  params: ResultAssemblyParams,
): Promise<RagSearchResultItem[]> {
  const { candidateMap, rankedPool, filtered, topK, debug, logger } = params;

  const targetEntries =
    filtered.length > 0
      ? filtered.slice(0, topK)
      : rankedPool
          .slice()
          .sort((a, b) => b.rerankScore - a.rerankScore)
          .slice(0, 2);

  const isFallback = filtered.length === 0;

  if (isFallback) {
    logger?.info("rag_dual_score_fallback_partial", {
      service: "rag-search",
      data: {
        fallbackCount: targetEntries.length,
        topRerankScore: targetEntries[0]?.rerankScore ?? 0,
      },
    });
  }

  // Collect chunk targets for batch dynamic window retrieval
  const chunkTargets = targetEntries.map(({ rrf }) => {
    const candidate = candidateMap.get(rrf.id)!;
    return {
      resourceId: candidate.resourceId,
      chunkIndex: candidate.chunkIndex,
    };
  });

  const dynamicWindows = await fetchDynamicContextWindows(chunkTargets);

  return targetEntries.map(
    ({ rrf, relevanceScore, rerankScore, denseScore }) => {
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

      const dynamicKey = `${candidate.resourceId}:${candidate.chunkIndex}`;
      const parentContent = dynamicWindows.get(dynamicKey) || candidate.content;

      return {
        resourceId: candidate.resourceId,
        resourceTitle: candidate.title,
        resourceAuthors: formatResourceAuthors({
          authors: candidate.authors,
        }),
        resourceYear: candidate.publicationYear ?? null,
        chunkIndex: candidate.chunkIndex,
        pageNumber: candidate.pageNumber,
        sectionTitle: candidate.section ?? null,
        content: candidate.content,
        parentContent,
        relevanceScore,
        denseScore,
        isPartialMatch: isFallback,
        ...(debugMeta ? { debug: debugMeta } : {}),
      };
    },
  );
}
