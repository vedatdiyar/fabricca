"use client";

import { useState } from "react";
import { toast } from "sonner";
import { toggleResourceReadStatusAction } from "@/app/(app)/library/actions";
import type { ThesisBox, LibraryResource } from "@/db/schema";
import {
  addTaskAction,
  updateTaskStatusAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/app/(app)/dashboard/actions";
import { BoxCard } from "./box-card";
import { KanbanBoard } from "./kanban-board";
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

interface DashboardContentProps {
  initialBoxes: ThesisBox[];
  initialResources: LibraryResource[];
  initialTasks: TaskRow[];
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

/**
 * Dashboard etkileşimli alan koordinatörü (Client Component).
 * Konu Kutuları verileri ile Kanban Board görev akışını birleştiren
 * "Sonsuz Okuma Döngüsü" (Infinite Reading Loop) durum yönetimini koordine eder.
 *
 * @param props.initialBoxes - DB'den gelen ham konu kutuları
 * @param props.initialResources - DB'den gelen ham makaleler
 * @param props.initialTasks - DB'den gelen kayıtlı görevler
 */
export function DashboardContent({
  initialBoxes,
  initialResources,
  initialTasks,
}: DashboardContentProps) {
  // 1. Makaleleri durum yönetimi için state'e aktar ve öncelikli sıralama yap
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
          isInInitialStarterPack: index < 3,
          boxId: String(res.thesisBoxId),
          boxTitle: box.title,
        });
      });
    });

    return mapped;
  });

  // 2. Kullanıcı tarafından eklenen görevler (DB'den gelen initialTasks ile başlat)
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

  // 3. Okuma görevlerinin Kanban üzerindeki durumlarını sakla
  const [readingTaskStatuses, setReadingTaskStatuses] = useState<
    Record<string, "TODO" | "IN_PROGRESS" | "DONE">
  >(() => {
    const initialStatuses: Record<string, "TODO" | "IN_PROGRESS" | "DONE"> = {};
    initialResources.forEach((res) => {
      initialStatuses[String(res.id)] = res.isRead ? "DONE" : "TODO";
    });
    return initialStatuses;
  });

  const getVisibleArticlesForBox = (boxId: string): ArticleState[] => {
    const boxArticles = articles.filter((a) => a.boxId === boxId);

    const starterPack = boxArticles.filter((a) => a.isInInitialStarterPack);
    const reservedPool = boxArticles.filter((a) => !a.isInInitialStarterPack);

    const unreadStarter = starterPack.filter((a) => !a.isRead);
    const readStarterCount = starterPack.filter((a) => a.isRead).length;
    const unreadReserved = reservedPool.filter((a) => !a.isRead);

    return [...unreadStarter, ...unreadReserved.slice(0, readStarterCount)];
  };

  // 4. Konu Kutularını görüntülenecek makalelerle eşle
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

  /**
   * Aktif görüntülenecek okuma görevlerini üretir.
   */
  const getActiveReadingTasks = (): KanbanTask[] => {
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
  };

  // 5. Normal görevler ile dinamik okuma görevlerini birleştir
  const combinedTasks = [...userTasks, ...getActiveReadingTasks()];

  /**
   * Kanban üzerinde görev durumu değiştiğinde tetiklenir.
   */
  const handleTaskStatusChange = async (
    taskId: string,
    newStatus: "TODO" | "IN_PROGRESS" | "DONE",
  ) => {
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
  };

  /**
   * Yeni görev ekler (DB'ye kaydeder).
   */
  const handleAddTask = async (taskInput: Omit<KanbanTask, "id">) => {
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
  };

  /**
   * Görevi düzenler (DB'ye kaydeder).
   */
  const handleEditTask = async (
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
  };

  /**
   * Görevi siler (DB'den siler).
   */
  const handleDeleteTask = async (taskId: string) => {
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
  };

  return (
    <div className="w-full space-y-8">
      {/* Top Section: Topic Boxes */}
      <section className="space-y-4">
        <div>
          <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
            Konu Kutuları ve Başlangıç Paketleri
          </h2>
          <p className="font-sans text-sm text-muted-foreground mt-1">
            Araştırma alanlarınıza önerilen akademik kaynaklar. Okundukça yerini
            yedek kaynaklara bırakır.
          </p>
        </div>

        {topicBoxes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center rounded-md border border-dashed border-border/40 bg-card">
            <p className="text-sm text-muted-foreground">
              Henüz tanımlanmış bir konu kutunuz bulunmuyor. Lütfen onboarding
              adımlarını tamamlayın.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {topicBoxes.map((box) => (
              <BoxCard key={box.id} box={box} />
            ))}
          </div>
        )}
      </section>

      {/* Spacing separator */}
      <div className="border-t border-border/40 my-8" />

      {/* Bottom Section: Kanban Board */}
      <section className="space-y-4">
        <KanbanBoard
          tasks={combinedTasks}
          onTaskStatusChange={handleTaskStatusChange}
          onAddTask={handleAddTask}
          onEditTask={handleEditTask}
          onDeleteTask={handleDeleteTask}
          boxes={initialBoxes}
        />
      </section>
    </div>
  );
}
