"use client";

import { useState, useCallback, useMemo } from "react";
import type { Box, Source } from "@/db/schema";
import type { TopicBox } from "../_types";
import { sortLibraryResources } from "@/lib/academic/utils";
import { formatAuthorDisplayString } from "@/lib/academic/author-formatter";
import { BOX_TYPE_DESCRIPTIONS, type ThesisBoxType } from "@/lib/box-constants";

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
  /** Actual thesisBoxId the resource belongs to (sub-box or the main box itself). */
  subBoxId: string;
  /** Title of the sub-box, present only when the resource is linked to a child box. */
  subBoxTitle?: string;
}

/**
 * Builds the article state list by mapping each library resource to its effective parent box.
 *
 * @param initialBoxes - Parent topic boxes loaded from the server.
 * @param initialResources - Library resources loaded from the server.
 * @param childIdToParentId - Mapping from child box ids to their parent box ids.
 * @param boxIdToTitle - Mapping from box ids to their titles.
 * @returns The flattened article state entries grouped by parent box.
 */
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
        author: formatAuthorDisplayString({
          authors: res.authors,
          publisher: res.publisher,
          boxType: box.boxType,
        }),
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
 * Round-robin merges unread articles across sub-box groups so every sub-box is represented in the reading list.
 *
 * @param boxArticles - Articles belonging to a single topic box.
 * @param capacity - Maximum number of articles to include.
 * @returns The selected reading list entries.
 */
function buildVisibleReadingList(
  boxArticles: ArticleState[],
  capacity: number,
): ArticleState[] {
  const unreadArticles = boxArticles.filter((a) => !a.isRead);
  if (unreadArticles.length === 0) {
    return [];
  }

  const groups = new Map<string, ArticleState[]>();
  for (const art of unreadArticles) {
    const list = groups.get(art.subBoxId) ?? [];
    list.push(art);
    groups.set(art.subBoxId, list);
  }

  const activeGroups = [...groups.values()];

  const result: ArticleState[] = [];
  const pointers = activeGroups.map(() => 0);
  const seen = new Set<string>();
  let placed = 0;

  while (placed < capacity) {
    let advanced = false;

    for (let gi = 0; gi < activeGroups.length; gi++) {
      const group = activeGroups[gi];
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
 * Manages article state, visibility algorithms, and topic box derivation for the dashboard.
 *
 * @param initialBoxes - Parent topic boxes loaded from the server.
 * @param initialResources - Library resources loaded from the server.
 * @param childIdToParentId - Mapping from child box ids to their parent box ids.
 * @param allBoxRows - All box rows including child boxes.
 * @returns The article state, derived topic boxes, and article mutation helpers.
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
        description:
          box.description && box.description.trim().length > 0
            ? box.description
            : (BOX_TYPE_DESCRIPTIONS[box.boxType as ThesisBoxType] ?? ""),
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
