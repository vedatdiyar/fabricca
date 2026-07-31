"use client";

import { useState, useCallback, useMemo } from "react";
import type { Box, Source } from "@/db/schema";
import type { TopicBox } from "../_types";
import { sortLibraryResources } from "@/lib/academic/utils";

/** Maximum number of articles shown in a topic box's reading list. */
const BOX_READING_LIST_CAPACITY = 4;

interface ArticleState {
  id: string;
  title: string;
  author: string;
  year: number;
  isRead: boolean;
  isFoundational: boolean;
  boxId: string;
  boxTitle: string;
  /** Actual thesisBoxId the resource belongs to (sub-box or the main box itself) */
  subBoxId: string;
  /** Title of the sub-box, present only when the resource is linked to a child box */
  subBoxTitle?: string;
}

function buildArticleState(
  initialBoxes: Box[],
  initialResources: Source[],
  childIdToParentId: Map<number, number>,
  boxIdToTitle: Map<number, string>,
): ArticleState[] {
  const mapped: ArticleState[] = [];

  initialBoxes.forEach((box) => {
    const boxRes = initialResources.filter((r) => {
      const effectiveParentId = childIdToParentId.get(r.boxId) ?? r.boxId;
      return effectiveParentId === box.id;
    });
    const sortedRes = sortLibraryResources(boxRes);

    sortedRes.forEach((res) => {
      const effectiveParentId = childIdToParentId.get(res.boxId) ?? res.boxId;

      mapped.push({
        id: String(res.id),
        title: res.title,
        author:
          res.authors && res.authors.length > 0
            ? res.authors.join(", ")
            : "Bilinmeyen Yazar",
        year: res.publicationYear ?? 0,
        isRead: res.isRead ?? false,
        isFoundational: res.isFoundational,
        boxId: String(effectiveParentId),
        boxTitle: box.title,
        subBoxId: String(res.boxId),
        subBoxTitle: childIdToParentId.has(res.boxId)
          ? (boxIdToTitle.get(res.boxId) ?? undefined)
          : undefined,
      });
    });
  });

  return mapped;
}

/**
 * Balanced round-robin merge of unread articles across sub-box groups.
 * Rotates through each group (S1, S2, ..., Sn, S1, ...) so every sub-box is
 * represented in the reading list instead of letting a single dominant
 * sub-box occupy the whole list. Duplicate articles (cross-sub-box) are skipped.
 *
 * @param boxArticles - All articles belonging to a main box (academically sorted per sub-box)
 * @param capacity - Maximum number of articles to collect
 * @returns The balanced visible reading list
 */
function buildVisibleReadingList(
  boxArticles: ArticleState[],
  capacity: number,
): ArticleState[] {
  // Group by sub-box, preserving the academic sort order within each group
  const groups = new Map<string, ArticleState[]>();
  for (const art of boxArticles) {
    const list = groups.get(art.subBoxId) ?? [];
    list.push(art);
    groups.set(art.subBoxId, list);
  }

  // Only unread articles are candidates for the reading list
  const unreadGroups = [...groups.values()]
    .map((group) => group.filter((a) => !a.isRead))
    .filter((group) => group.length > 0);

  const result: ArticleState[] = [];
  const pointers = unreadGroups.map(() => 0);
  const seen = new Set<string>();
  let placed = 0;

  while (placed < capacity) {
    let advanced = false;

    for (let gi = 0; gi < unreadGroups.length; gi++) {
      const group = unreadGroups[gi];
      while (pointers[gi] < group.length && seen.has(group[pointers[gi]].id)) {
        pointers[gi]++;
      }
      if (pointers[gi] >= group.length) continue;

      const candidate = group[pointers[gi]++];
      if (seen.has(candidate.id)) continue;

      seen.add(candidate.id);
      result.push(candidate);
      placed++;
      advanced = true;

      if (placed >= capacity) break;
    }

    if (!advanced) break;
  }

  return result;
}

/**
 * Manages article (library resource) state, visibility algorithms,
 * and topic box derivation for the dashboard.
 */
export function useDashboardArticles(
  initialBoxes: Box[],
  initialResources: Source[],
  childIdToParentId: Map<number, number>,
  allBoxRows: Box[],
) {
  const [articles, setArticles] = useState<ArticleState[]>(() =>
    buildArticleState(
      initialBoxes,
      initialResources,
      childIdToParentId,
      new Map(allBoxRows.map((b) => [b.id, b.title])),
    ),
  );

  const getVisibleArticlesForBox = useCallback(
    (boxId: string): ArticleState[] =>
      buildVisibleReadingList(
        articles.filter((a) => a.boxId === boxId),
        BOX_READING_LIST_CAPACITY,
      ),
    [articles],
  );

  const topicBoxes: TopicBox[] = useMemo(
    () =>
      initialBoxes.map((box) => ({
        id: String(box.id),
        title: box.title,
        description: box.description ?? "",
        articles: getVisibleArticlesForBox(String(box.id)).map((art) => ({
          id: art.id,
          title: art.title,
          author: art.author,
          year: art.year,
          isRead: art.isRead,
          subBoxTitle: art.subBoxTitle,
        })),
      })),
    [initialBoxes, getVisibleArticlesForBox],
  );

  const updateArticleReadStatus = useCallback(
    (articleId: string, isRead: boolean) => {
      setArticles((prev) =>
        prev.map((art) => (art.id === articleId ? { ...art, isRead } : art)),
      );
    },
    [],
  );

  const removeArticle = useCallback((articleId: string) => {
    setArticles((prev) => prev.filter((art) => art.id !== articleId));
  }, []);

  return {
    articles,
    topicBoxes,
    getVisibleArticlesForBox,
    updateArticleReadStatus,
    removeArticle,
    setArticles,
  };
}
