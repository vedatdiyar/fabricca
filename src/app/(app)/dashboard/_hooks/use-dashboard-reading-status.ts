"use client";

import { useState, useCallback } from "react";
import type { KanbanTask } from "../_lib/types";

interface ArticleState {
  id: string;
  title: string;
  author: string;
  year: number;
  isRead: boolean;
  isFoundational: boolean;
  boxId: string;
  boxTitle: string;
}

/**
 * Manages reading task status tracking and generates reading task entries for the Kanban board.
 *
 * @param initialResources - Initial library resources with their read status.
 * @returns Reading task statuses, their setter, and reading task helpers.
 */
export function useDashboardReadingStatus(
  initialResources: { id: number; isRead: boolean | null }[],
) {
  const [readingTaskStatuses, setReadingTaskStatuses] = useState<
    Record<string, "TODO" | "IN_PROGRESS" | "DONE">
  >(() => {
    const initialStatuses: Record<string, "TODO" | "IN_PROGRESS" | "DONE"> = {};
    initialResources.forEach((res) => {
      initialStatuses[String(res.id)] = res.isRead ? "DONE" : "TODO";
    });
    return initialStatuses;
  });

  const getActiveReadingTasks = useCallback(
    (articles: ArticleState[]): KanbanTask[] => {
      const firstUnreadByBox: Record<string, string> = {};

      articles.forEach((a) => {
        if (!a.isRead && !firstUnreadByBox[a.boxId]) {
          firstUnreadByBox[a.boxId] = a.id;
        }
      });

      return articles
        .filter((a) => {
          const isMarkedDone = readingTaskStatuses[a.id] === "DONE" || a.isRead;
          const isFirstUnreadForBox = firstUnreadByBox[a.boxId] === a.id;
          return isMarkedDone || isFirstUnreadForBox;
        })
        .map((a) => ({
          id: `read-task-${a.id}`,
          title: a.title,
          description: `${a.author}${a.year && a.year > 0 ? ` (${a.year})` : ""} kaynağını okuyup tezine katkılarını çıkar.`,
          status: readingTaskStatuses[a.id] || "TODO",
          priority: "MEDIUM" as const,
          isReadingTask: true,
          articleId: a.id,
          boxTitle: a.boxTitle,
        }));
    },
    [readingTaskStatuses],
  );

  const removeReadingTask = useCallback((articleId: string) => {
    setReadingTaskStatuses((prev) => {
      if (!(articleId in prev)) return prev;
      const next = { ...prev };
      delete next[articleId];
      return next;
    });
  }, []);

  return {
    readingTaskStatuses,
    setReadingTaskStatuses,
    getActiveReadingTasks,
    removeReadingTask,
  };
}
