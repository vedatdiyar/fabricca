"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { deleteLibraryResourceAction as deleteLibraryResource } from "@/app/(app)/library/actions";
import { refreshDashboardDataAction } from "@/app/(app)/dashboard/dashboard-data-actions";
import type { Box, Source } from "@/core/db/schema";
import type { TaskRow } from "../_lib/schemas";
import { useDashboardArticles } from "./use-dashboard-articles";
import { useDashboardTasks } from "./use-dashboard-tasks";

/**
 * Facade hook composing the article and unified academic task hooks into a unified dashboard API.
 *
 * @param initialBoxes - Parent topic boxes loaded from the server.
 * @param initialResources - Library resources loaded from the server.
 * @param initialTasks - User & automated academic tasks loaded from the server.
 * @param childIdToParentId - Mapping from child box ids to their parent box ids.
 * @param allBoxRows - All box rows including child boxes.
 * @returns Derived topic boxes, unified tasks, and dashboard mutation handlers.
 */
export function useDashboard(
  initialBoxes: Box[],
  initialResources: Source[],
  initialTasks: TaskRow[],
  childIdToParentId: Map<number, number>,
  allBoxRows: Box[],
) {
  const { articles, topicBoxes, removeArticle, setArticles, reloadResources } =
    useDashboardArticles(
      initialBoxes,
      initialResources,
      childIdToParentId,
      allBoxRows,
    );

  const {
    tasks: combinedTasks,
    handleAddTask,
    handleEditTask,
    handleTaskStatusChange,
    handleDeleteTask,
    handleSyncTasks,
  } = useDashboardTasks(initialTasks);

  const handleDeleteArticle = useCallback(
    async (articleId: string) => {
      const articleExists = articles.some((a) => a.id === articleId);
      if (!articleExists) return;

      const removedArticle = articles.find((a) => a.id === articleId);

      removeArticle(articleId);

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
    [articles, removeArticle, setArticles],
  );

  const handleExpansionSuccess = useCallback(async () => {
    try {
      const res = await refreshDashboardDataAction();
      if (!res.success) {
        throw new Error(res.error);
      }
      reloadResources(res.data.parentBoxes, res.data.resources);
      await handleSyncTasks();
    } catch (err) {
      toast.error(
        `Literatür genişletme sonrası veriler güncellenemedi: ${
          err instanceof Error ? err.message : "Bağlantı hatası."
        }`,
      );
    }
  }, [reloadResources, handleSyncTasks]);

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
