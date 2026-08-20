import { rerankWithCohere } from "@/core/services/ai/cohere";
import type { CandidateSource } from "./types";
import {
  selectWithGemini,
  type SuspiciousEntry,
} from "./gemini-selection-client";
import type { filterCandidates } from "./fuzzy-dedup";

/**
 * Applies Cohere Rerank as a tie-breaker within the same co-citation tier,
 * preserving co-citation primacy by weighting co-citation count.
 *
 * @param poolForCohere - Confirmed candidates to rerank.
 * @param thesisContext - Thesis subject problem and framework context.
 * @returns Re-ordered candidate pool.
 */
export async function rankWithCohereTieBreaker(
  poolForCohere: CandidateSource[],
  thesisContext: string,
): Promise<CandidateSource[]> {
  if (
    poolForCohere.length <= 1 ||
    !thesisContext ||
    !process.env.COHERE_API_KEY
  ) {
    return poolForCohere;
  }

  try {
    const documents = poolForCohere.map(
      (c) => `${c.title}. ${c.authors.join(", ")}. ${c.publisher ?? ""}`,
    );

    const rerankResults = await rerankWithCohere({
      query: thesisContext.substring(0, 4000),
      documents,
    });

    // Sort by Cohere score but preserve co-citation primacy:
    // multiply co-citation count × 1000 and add Cohere score so higher
    // co-citation always wins over lower co-citation regardless of Cohere.
    const scoredList = rerankResults.map((res) => {
      const c = poolForCohere[res.index];
      const combinedScore =
        (c?.relevanceScore ?? 0) * 1000 + res.relevanceScore;
      return { candidate: c, combinedScore };
    });

    scoredList.sort((a, b) => b.combinedScore - a.combinedScore);
    return scoredList
      .filter((s) => s.candidate !== undefined)
      .map((s) => s.candidate!);
  } catch {
    // Cohere unavailable — fall back to co-citation order
    return poolForCohere;
  }
}

export interface CandidateSelectionParams {
  thesisContext: string;
  rerankedPool: CandidateSource[];
  suspicious: ReturnType<typeof filterCandidates>["suspicious"];
  suspiciousCandidates: CandidateSource[];
  allUserSources: Array<{
    title: string;
    doi: string | null;
    authors: string[] | null;
  }>;
  requiredCount: number;
}

/**
 * Coordinates final candidate selection using Gemini LLM, reviewing suspicious candidates
 * and selecting the optimal pool within thesis context.
 *
 * @param params - Candidates, context, suspicious list, and target count.
 * @returns Selected CandidateSource array.
 */
export async function coordinateCandidateSelection(
  params: CandidateSelectionParams,
): Promise<CandidateSource[]> {
  const {
    thesisContext,
    rerankedPool,
    suspicious,
    suspiciousCandidates,
    allUserSources,
    requiredCount,
  } = params;

  const allCandidatesForLlm = [...rerankedPool, ...suspiciousCandidates];

  const suspiciousEntries: SuspiciousEntry[] = suspicious.map((s) => ({
    candidateTitle: s.title,
    candidateAuthors: s.authors,
    matchedExistingTitle: s.matchedTitle,
    titleScore: s.titleScore,
    authorScore: s.authorScore,
  }));

  const existingSnippets = allUserSources.map((s) => ({
    title: s.title,
    authors: s.authors ?? [],
  }));

  return selectWithGemini(
    {
      thesisContext,
      confirmedCandidates: rerankedPool.map((c, i) => ({
        index: i,
        title: c.title,
        authors: c.authors,
        coAuthorCount: c.relevanceScore ?? 0,
      })),
      suspiciousCandidates: suspiciousEntries,
      existingSources: existingSnippets,
      targetCount: requiredCount,
    },
    allCandidatesForLlm,
  );
}
