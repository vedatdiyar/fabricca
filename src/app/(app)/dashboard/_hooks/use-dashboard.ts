"use client";

import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  toggleResourceReadStatusAction,
  deleteLibraryResourceAction as deleteLibraryResource,
} from "@/app/(app)/library/actions";
import { refreshDashboardDataAction } from "@/app/(app)/dashboard/actions";
import type { Box, Source } from "@/db/schema";
import type { TaskRow } from "../_lib/schemas";
import { useDashboardArticles } from "./use-dashboard-articles";
import { useDashboardTasks } from "./use-dashboard-tasks";
import { useDashboardReadingStatus } from "./use-dashboard-reading-status";

/**
 * Facade hook composing the article, task, and reading status hooks into a unified dashboard API.
 *
 * @param initialBoxes - Parent topic boxes loaded from the server.
 * @param initialResources - Library resources loaded from the server.
 * @param initialTasks - User tasks loaded from the server.
 * @param childIdToParentId - Mapping from child box ids to their parent box ids.
 * @param allBoxRows - All box rows including child boxes.
 * @returns Derived topic boxes, combined tasks, and dashboard mutation handlers.
 */
export function useDashboard(
  initialBoxes: Box[],
  initialResources: Source[],
  initialTasks: TaskRow[],
  childIdToParentId: Map<number, number>,
  allBoxRows: Box[],
) {
  const {
    articles,
    topicBoxes,
    updateArticleReadStatus,
    removeArticle,
    setArticles,
    reloadResources,
  } = useDashboardArticles(
    initialBoxes,
    initialResources,
    childIdToParentId,
    allBoxRows,
  );

  const {
    readingTaskStatuses,
    setReadingTaskStatuses,
    getActiveReadingTasks,
    removeReadingTask,
  } = useDashboardReadingStatus(initialResources);

  const {
    userTasks,
    handleAddTask,
    handleEditTask,
    handleUserTaskStatusChange,
    handleDeleteTask,
  } = useDashboardTasks(initialTasks);

  const combinedTasks = useMemo(
    () => [...userTasks, ...getActiveReadingTasks(articles)],
    [userTasks, getActiveReadingTasks, articles],
  );

  const handleTaskStatusChange = useCallback(
    async (taskId: string, newStatus: "TODO" | "IN_PROGRESS" | "DONE") => {
      if (taskId.startsWith("read-task-")) {
        const articleId = taskId.replace("read-task-", "");
        const previousStatus = readingTaskStatuses[articleId] || "TODO";
        const previousIsRead = previousStatus === "DONE";

        setReadingTaskStatuses((prev) => ({
          ...prev,
          [articleId]: newStatus,
        }));
        updateArticleReadStatus(articleId, newStatus === "DONE");

        try {
          const res = await toggleResourceReadStatusAction(
            Number(articleId),
            newStatus === "DONE",
          );
          if (!res.success) {
            throw new Error(res.error);
          }
          toast.success(
            newStatus === "DONE"
              ? "Resource marked as read and database updated."
              : "Resource reverted to unread.",
          );
        } catch (err) {
          setReadingTaskStatuses((prev) => ({
            ...prev,
            [articleId]: previousStatus,
          }));
          updateArticleReadStatus(articleId, previousIsRead);
          toast.error(
            `Failed to update read status: ${
              err instanceof Error ? err.message : "Connection error."
            }`,
          );
        }
      } else {
        handleUserTaskStatusChange(taskId, newStatus);
      }
    },
    [
      readingTaskStatuses,
      setReadingTaskStatuses,
      updateArticleReadStatus,
      handleUserTaskStatusChange,
    ],
  );

  const handleDeleteArticle = useCallback(
    async (articleId: string) => {
      const articleExists = articles.some((a) => a.id === articleId);
      if (!articleExists) return;

      const removedArticle = articles.find((a) => a.id === articleId);

      removeArticle(articleId);
      removeReadingTask(articleId);

      try {
        const res = await deleteLibraryResource(Number(articleId));
        if (!res.success) {
          throw new Error(res.error);
        }
        toast.success("Eser Kütüphane'den kalıcı olarak silindi.");
      } catch (err) {
        if (removedArticle) {
          setArticles((prev) =>
            prev.some((a) => a.id === articleId)
              ? prev
              : [...prev, removedArticle],
          );
        }
        toast.error(
          `Eser silinemedi: ${
            err instanceof Error ? err.message : "Bağlantı hatası."
          }`,
        );
      }
    },
    [articles, removeArticle, removeReadingTask, setArticles],
  );

  const handleExpansionSuccess = useCallback(async () => {
    try {
      const res = await refreshDashboardDataAction();
      if (!res.success) {
        throw new Error(res.error);
      }
      reloadResources(res.data.parentBoxes, res.data.resources);
    } catch (err) {
      toast.error(
        `Literatür genişletme sonrası veriler güncellenemedi: ${
          err instanceof Error ? err.message : "Bağlantı hatası."
        }`,
      );
    }
  }, [reloadResources]);

  return {
    topicBoxes,
    combinedTasks,
    handleTaskStatusChange,
    handleAddTask,
    handleEditTask,
    handleDeleteTask,
    handleDeleteArticle,
    handleExpansionSuccess,
  };
}
