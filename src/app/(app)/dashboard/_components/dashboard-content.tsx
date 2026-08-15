"use client";

import { useMemo } from "react";
import { FolderKanban, BookOpen, CheckSquare, Sparkles } from "lucide-react";
import type { Box, Source } from "@/db/schema";
import type { TaskRow } from "../_lib/schemas";
import { Card, CardContent } from "@/components/ui/card";
import { BoxCard } from "./box-card";
import { KanbanBoard } from "./kanban-board";
import { useDashboard } from "../_hooks/use-dashboard";

interface DashboardContentProps {
  initialBoxes: Box[];
  initialResources: Source[];
  initialTasks: TaskRow[];
  childIdToParentId: Map<number, number>;
  allBoxRows: Box[];
}

/**
 * Renders the interactive dashboard with topic boxes, overview metrics, and the Kanban board.
 *
 * @param root0 - Component props.
 * @param root0.initialBoxes - Parent topic boxes loaded from the server.
 * @param root0.initialResources - Library resources loaded from the server.
 * @param root0.initialTasks - User tasks loaded from the server.
 * @param root0.childIdToParentId - Mapping from child box ids to their parent box ids.
 * @param root0.allBoxRows - All box rows including child boxes.
 * @returns The rendered dashboard content.
 */
export function DashboardContent({
  initialBoxes,
  initialResources,
  initialTasks,
  childIdToParentId,
  allBoxRows,
}: DashboardContentProps) {
  const {
    topicBoxes,
    combinedTasks,
    handleTaskStatusChange,
    handleAddTask,
    handleEditTask,
    handleDeleteTask,
    handleDeleteArticle,
    handleExpansionSuccess,
  } = useDashboard(
    initialBoxes,
    initialResources,
    initialTasks,
    childIdToParentId,
    allBoxRows,
  );

  // Compute dashboard metrics
  const stats = useMemo(() => {
    let totalArticles = 0;
    let readArticles = 0;
    let maxExpansionCycle = 1;
    let anyReadyToExpand = false;

    for (const box of topicBoxes) {
      totalArticles += box.articles.length;
      readArticles += box.articles.filter((a) => a.isRead).length;
      if (box.expansionCycle > maxExpansionCycle) {
        maxExpansionCycle = box.expansionCycle;
      }
      if (box.isReadyToExpand) {
        anyReadyToExpand = true;
      }
    }

    const todoAndInProgressTasks = combinedTasks.filter(
      (t) => t.status === "TODO" || t.status === "IN_PROGRESS",
    ).length;
    const doneTasks = combinedTasks.filter((t) => t.status === "DONE").length;

    const readPercentage =
      totalArticles > 0 ? Math.round((readArticles / totalArticles) * 100) : 0;

    return {
      totalBoxes: topicBoxes.length,
      totalArticles,
      readArticles,
      readPercentage,
      activeTasks: todoAndInProgressTasks,
      completedTasks: doneTasks,
      maxExpansionCycle,
      anyReadyToExpand,
    };
  }, [topicBoxes, combinedTasks]);

  return (
    <div className="w-full space-y-8">
      {/* Page Header */}
      <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
            Genel Özet ve Araştırma Paneli
          </h1>
          <p className="font-sans text-sm text-muted-foreground mt-1">
            Tez odak alanlarınız, dinamik okuma listeleriniz ve anlık akademik
            çalışma akışınız.
          </p>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Konu Kutuları */}
        <Card className="border border-border bg-card">
          <CardContent className="flex items-center justify-between p-4.5">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Konu Kutuları
              </p>
              <p className="font-serif text-2xl font-bold tracking-tight text-foreground">
                {stats.totalBoxes}
              </p>
              <p className="text-xs text-muted-foreground">
                Aktif araştırma teması
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
              <FolderKanban className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Okuma İlerlemesi */}
        <Card className="border border-border bg-card">
          <CardContent className="flex items-center justify-between p-4.5">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Okuma İlerlemesi
              </p>
              <p className="font-serif text-2xl font-bold tracking-tight text-foreground">
                {stats.readArticles} / {stats.totalArticles}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.totalArticles > 0
                  ? `%${stats.readPercentage} tamamlandı`
                  : "Henüz eser eklenmedi"}
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
              <BookOpen className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Akademik Görevler */}
        <Card className="border border-border bg-card">
          <CardContent className="flex items-center justify-between p-4.5">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Akademik Görevler
              </p>
              <p className="font-serif text-2xl font-bold tracking-tight text-foreground">
                {stats.activeTasks} Aktif
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.completedTasks} tamamlanan adım
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-info/20 bg-info/10 text-info">
              <CheckSquare className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 4: Literatür Genişletme */}
        <Card className="border border-border bg-card">
          <CardContent className="flex items-center justify-between p-4.5">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Literatür Döngüsü
              </p>
              <p className="font-serif text-2xl font-bold tracking-tight text-foreground">
                Döngü #{stats.maxExpansionCycle}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.anyReadyToExpand
                  ? "Genişletmeye hazır"
                  : "Kaynaklar inceleniyor"}
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-purple-500/20 bg-purple-500/10 text-purple-400">
              <Sparkles className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 1: Topic Boxes */}
      <section className="space-y-6">
        <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border/60">
          <div>
            <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
              Konu Kutuları ve Okuma Listeleri
            </h2>
            <p className="font-sans text-sm text-muted-foreground mt-1">
              Araştırma alanlarınıza önerilen akademik kaynaklar. Okundukça
              yerini yedek kaynaklara bırakır.
            </p>
          </div>
        </div>

        {topicBoxes.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-8 text-center rounded-md border border-dashed border-border/40">
            <p className="text-sm text-muted-foreground">
              Henüz tanımlanmış bir konu kutunuz bulunmuyor. Lütfen onboarding
              adımlarını tamamlayın.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {topicBoxes.map((box) => (
              <BoxCard
                key={box.id}
                box={box}
                onDeleteArticle={handleDeleteArticle}
                onExpansionSuccess={handleExpansionSuccess}
              />
            ))}
          </div>
        )}
      </section>

      {/* Section Divider */}
      <div className="border-t border-border/40 my-8" />

      {/* Section 2: Kanban Board */}
      <section className="space-y-6">
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
