"use client";

import { useState, useCallback, useMemo } from "react";
import type { ThesisBox, LibraryResource } from "@/db/schema";
import type { TopicBox } from "../_types";
import { sortLibraryResources } from "@/lib/academic/utils";

interface ArticleState {
  id: string;
  title: string;
  author: string;
  year: number;
  isRead: boolean;
  isFoundational: boolean;
  isInInitialStarterPack: boolean;
  boxId: string;
  boxTitle: string;
}

function buildArticleState(
  initialBoxes: ThesisBox[],
  initialResources: LibraryResource[],
): ArticleState[] {
  const mapped: ArticleState[] = [];

  initialBoxes.forEach((box) => {
    const boxRes = initialResources.filter((r) => r.thesisBoxId === box.id);
    const sortedRes = sortLibraryResources(boxRes);

    sortedRes.forEach((res, index) => {
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
        isInInitialStarterPack: index < 4,
        boxId: String(res.thesisBoxId),
        boxTitle: box.title,
      });
    });
  });

  return mapped;
}

/**
 * Manages article (library resource) state, visibility algorithms,
 * and topic box derivation for the dashboard.
 */
export function useDashboardArticles(
  initialBoxes: ThesisBox[],
  initialResources: LibraryResource[],
) {
  const [articles, setArticles] = useState<ArticleState[]>(() =>
    buildArticleState(initialBoxes, initialResources),
  );

  const getVisibleArticlesForBox = useCallback(
    (boxId: string): ArticleState[] => {
      const boxArticles = articles.filter((a) => a.boxId === boxId);

      const starterPack = boxArticles.filter((a) => a.isInInitialStarterPack);
      const reservedPool = boxArticles.filter((a) => !a.isInInitialStarterPack);

      const unreadStarter = starterPack.filter((a) => !a.isRead);
      const readStarterCount = starterPack.filter((a) => a.isRead).length;
      const unreadReserved = reservedPool.filter((a) => !a.isRead);

      return [...unreadStarter, ...unreadReserved.slice(0, readStarterCount)];
    },
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

  return {
    articles,
    topicBoxes,
    getVisibleArticlesForBox,
    updateArticleReadStatus,
  };
}
