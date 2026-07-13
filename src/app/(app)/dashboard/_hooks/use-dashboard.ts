"use client";

import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { toggleResourceReadStatusAction } from "@/app/(app)/library/actions";
import type { ThesisBox, LibraryResource } from "@/db/schema";
import type { TaskRow } from "../_lib/schemas";
import { useDashboardArticles } from "./use-dashboard-articles";
import { useDashboardTasks } from "./use-dashboard-tasks";
import { useDashboardReadingStatus } from "./use-dashboard-reading-status";

/**
 * Facade hook that composes useDashboardArticles, useDashboardTasks,
 * and useDashboardReadingStatus into a single unified dashboard API.
 * Handles cross-cutting orchestration (reading task → article update).
 */
export function useDashboard(
  initialBoxes: ThesisBox[],
  initialResources: LibraryResource[],
  initialTasks: TaskRow[],
) {
  const { articles, topicBoxes, updateArticleReadStatus } =
    useDashboardArticles(initialBoxes, initialResources);

  const { readingTaskStatuses, setReadingTaskStatuses, getActiveReadingTasks } =
    useDashboardReadingStatus(initialResources);

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
        // Capture the current (pre-mutation) reading status for safe rollback
        const previousStatus = readingTaskStatuses[articleId] || "TODO";
        const previousIsRead = previousStatus === "DONE";

        // Optimistic UI update
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
          // Rollback both states using captured previous values
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

  return {
    topicBoxes,
    combinedTasks,
    handleTaskStatusChange,
    handleAddTask,
    handleEditTask,
    handleDeleteTask,
  };
}
