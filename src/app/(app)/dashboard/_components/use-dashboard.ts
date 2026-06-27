"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { toggleResourceReadStatusAction } from "@/app/(app)/library/actions";
import type { ThesisBox, LibraryResource } from "@/db/schema";
import {
  addTaskAction,
  updateTaskStatusAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/app/(app)/dashboard/actions";
import type { TopicBox, KanbanTask } from "../types";

interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "HIGH" | "MEDIUM" | "LOW";
  thesisBoxId: number | null;
  boxTitle: string | null;
}

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

export function useDashboard(
  initialBoxes: ThesisBox[],
  initialResources: LibraryResource[],
  initialTasks: TaskRow[],
) {
  const [articles, setArticles] = useState<ArticleState[]>(() => {
    const mapped: ArticleState[] = [];

    initialBoxes.forEach((box) => {
      const boxRes = initialResources.filter((r) => r.thesisBoxId === box.id);

      const sortedRes = [...boxRes].sort((a, b) => {
        if (a.isFoundational && !b.isFoundational) return -1;
        if (!a.isFoundational && b.isFoundational) return 1;

        if (!a.isFoundational && !b.isFoundational) {
          const isThesisA = a.relevanceScore === 0.99;
          const isThesisB = b.relevanceScore === 0.99;
          if (isThesisA && !isThesisB) return -1;
          if (!isThesisA && isThesisB) return 1;
        }

        const scoreA = a.relevanceScore ?? 0;
        const scoreB = b.relevanceScore ?? 0;
        if (scoreA !== scoreB) return scoreB - scoreA;

        return a.id - b.id;
      });

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
  });

  const [userTasks, setUserTasks] = useState<KanbanTask[]>(() =>
    initialTasks.map((t) => ({
      id: String(t.id),
      title: t.title,
      description: t.description ?? undefined,
      status: t.status,
      priority: t.priority,
      thesisBoxId: t.thesisBoxId,
      boxTitle: t.boxTitle ?? undefined,
    })),
  );

  const [readingTaskStatuses, setReadingTaskStatuses] = useState<
    Record<string, "TODO" | "IN_PROGRESS" | "DONE">
  >(() => {
    const initialStatuses: Record<string, "TODO" | "IN_PROGRESS" | "DONE"> = {};
    initialResources.forEach((res) => {
      initialStatuses[String(res.id)] = res.isRead ? "DONE" : "TODO";
    });
    return initialStatuses;
  });

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

  const topicBoxes: TopicBox[] = initialBoxes.map((box) => ({
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
  }));

  const getActiveReadingTasks = useCallback((): KanbanTask[] => {
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
        description: `${a.author} (${a.year}) kaynağını okuyup tezine katkılarını çıkar.`,
        status: readingTaskStatuses[a.id] || "TODO",
        priority: "MEDIUM" as const,
        isReadingTask: true,
        articleId: a.id,
        boxTitle: a.boxTitle,
      }));
  }, [articles, readingTaskStatuses]);

  const combinedTasks = [...userTasks, ...getActiveReadingTasks()];

  const handleTaskStatusChange = useCallback(
    async (taskId: string, newStatus: "TODO" | "IN_PROGRESS" | "DONE") => {
      if (taskId.startsWith("read-task-")) {
        const articleId = taskId.replace("read-task-", "");
        const isRead = newStatus === "DONE";

        const oldStatus = readingTaskStatuses[articleId] || "TODO";

        setReadingTaskStatuses((prev) => ({
          ...prev,
          [articleId]: newStatus,
        }));

        setArticles((prev) =>
          prev.map((art) => (art.id === articleId ? { ...art, isRead } : art)),
        );

        try {
          const res = await toggleResourceReadStatusAction(
            Number(articleId),
            isRead,
          );
          if (!res.success) {
            throw new Error(res.error);
          }
          toast.success(
            isRead
              ? "Kaynak okundu olarak işaretlendi ve veritabanı güncellendi."
              : "Kaynak okunmadı durumuna geri çekildi.",
          );
        } catch (err) {
          setReadingTaskStatuses((prev) => ({
            ...prev,
            [articleId]: oldStatus,
          }));

          setArticles((prev) =>
            prev.map((art) =>
              art.id === articleId ? { ...art, isRead: !isRead } : art,
            ),
          );

          toast.error(
            `Okuma durumu güncellenemedi: ${
              err instanceof Error ? err.message : "Bağlantı hatası."
            }`,
          );
        }
      } else {
        const prevUserTasks = [...userTasks];

        setUserTasks((prev) =>
          prev.map((task) =>
            task.id === taskId ? { ...task, status: newStatus } : task,
          ),
        );

        try {
          const res = await updateTaskStatusAction(Number(taskId), newStatus);
          if (!res.success) {
            throw new Error(res.error);
          }
        } catch (err) {
          setUserTasks(prevUserTasks);
          toast.error(
            `Görev durumu güncellenemedi: ${
              err instanceof Error ? err.message : "Bağlantı hatası."
            }`,
          );
        }
      }
    },
    [userTasks, readingTaskStatuses],
  );

  const handleAddTask = useCallback(
    async (taskInput: Omit<KanbanTask, "id">) => {
      const res = await addTaskAction({
        title: taskInput.title,
        description: taskInput.description,
        status: taskInput.status,
        priority: taskInput.priority,
        thesisBoxId: taskInput.thesisBoxId ?? null,
      });

      if (!res.success || !res.data) {
        toast.error(res.error ?? "Görev eklenirken hata oluştu.");
        return;
      }

      const newTask: KanbanTask = {
        id: String(res.data.id),
        title: res.data.title,
        description: res.data.description ?? undefined,
        status: res.data.status,
        priority: res.data.priority,
        thesisBoxId: res.data.thesisBoxId,
        boxTitle: res.data.boxTitle ?? undefined,
      };

      setUserTasks((prev) => [...prev, newTask]);
      toast.success("Yeni tez görevi başarıyla eklendi ve kaydedildi.");
    },
    [],
  );

  const handleEditTask = useCallback(
    async (
      taskId: string,
      input: {
        title: string;
        priority: "HIGH" | "MEDIUM" | "LOW";
        thesisBoxId?: number | null;
      },
    ) => {
      const res = await updateTaskAction(Number(taskId), input);
      if (!res.success || !res.data) {
        toast.error(res.error ?? "Görev güncellenirken hata oluştu.");
        return false;
      }

      setUserTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                title: res.data!.title,
                priority: res.data!.priority,
                thesisBoxId: res.data!.thesisBoxId,
                boxTitle: res.data!.boxTitle ?? undefined,
              }
            : t,
        ),
      );

      toast.success("Görev başarıyla güncellendi.");
      return true;
    },
    [],
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      const prevUserTasks = [...userTasks];

      setUserTasks((prev) => prev.filter((t) => t.id !== taskId));

      try {
        const res = await deleteTaskAction(Number(taskId));
        if (!res.success) {
          throw new Error(res.error);
        }
        toast.success("Görev başarıyla silindi.");
      } catch (err) {
        setUserTasks(prevUserTasks);
        toast.error(
          `Görev silinemedi: ${
            err instanceof Error ? err.message : "Bağlantı hatası."
          }`,
        );
      }
    },
    [userTasks],
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
