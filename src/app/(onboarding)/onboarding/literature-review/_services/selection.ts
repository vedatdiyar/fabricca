import type { JuryArticle } from "@/lib/types";
import type { RawPaper } from "./literature-review-papers";
import { normalizeCleanTitle, extractOpenAlexId } from "@/lib/academic/utils";

interface QueueItem {
  subBoxTitle: string;
  boxType: string;
  boxDescription: string;
  rawPapers: RawPaper[];
}

/**
 * Scores candidates and selects up to 3 related articles, deduplicating titles globally.
 *
 * @param item - The queue item containing raw papers.
 * @param assignedTitles - Optional set of titles already assigned elsewhere.
 * @param foundationalTitle - Optional foundational title to exclude from selection.
 * @returns The selected related articles as jury articles.
 */
export function selectRelatedArticles(
  item: QueueItem,
  assignedTitles?: Set<string>,
  foundationalTitle?: string,
): JuryArticle[] {
  const candidatePool = item.rawPapers.filter((p) => p.title?.trim());
  const normalizedFoundational = foundationalTitle
    ? normalizeCleanTitle(foundationalTitle)
    : "";

  const scoredCandidates = candidatePool
    .map((paper) => ({ paper, score: paper.relevanceScore }))
    .sort((a, b) => b.score - a.score);

  const selected: typeof scoredCandidates = [];

  for (const it of scoredCandidates) {
    const normTitle = normalizeCleanTitle(it.paper.title!);
    if (normTitle === normalizedFoundational) {
      continue;
    }
    if (assignedTitles && assignedTitles.has(normTitle)) {
      continue;
    }

    selected.push(it);
    if (selected.length === 3) break;
  }

  if (selected.length < 3) {
    for (const it of scoredCandidates) {
      const normTitle = normalizeCleanTitle(it.paper.title!);
      if (normTitle === normalizedFoundational) {
        continue;
      }
      if (
        selected.some((s) => normalizeCleanTitle(s.paper.title!) === normTitle)
      ) {
        continue;
      }

      selected.push(it);
      if (selected.length === 3) break;
    }
  }

  return selected.map(
    (it) =>
      ({
        title: it.paper.title!,
        comparisonNote: null,
        openalexId: extractOpenAlexId(it.paper.openAlexId),
        doi: it.paper.doi,
        publisher: null,
        publicationYear: null,
        authors: it.paper.authors,
        isFoundational: false,
        relevanceScore: Math.round(it.score * 100),
      }) as JuryArticle,
  );
}

export type { QueueItem };
