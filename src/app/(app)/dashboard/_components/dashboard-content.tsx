"use client";

import { useMemo } from "react";
import { FolderKanban, BookOpen, CheckSquare, Sparkles } from "lucide-react";
import type { Box, Source } from "@/core/db/schema";
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
 * Renders the interactive dashboard with topic boxes, overview metrics, and the ADHD-balanced Kanban board.
 *
 * @param props - Component props.
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
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Konu Kutuları */}
        <Card className="border border-border bg-card">
          <CardContent className="flex items-center justify-between p-3">
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground truncate">
                Konu Kutuları
              </p>
              <p className="font-mono text-xs font-semibold tracking-tight text-foreground">
                {stats.totalBoxes}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                Aktif araştırma teması
              </p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
              <FolderKanban className="size-3.5" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Okuma İlerlemesi */}
        <Card className="border border-border bg-card">
          <CardContent className="flex items-center justify-between p-3">
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground truncate">
                Okuma İlerlemesi
              </p>
              <p className="font-mono text-xs font-semibold tracking-tight text-foreground">
                {stats.readArticles} / {stats.totalArticles}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {stats.totalArticles > 0
                  ? `%${stats.readPercentage} tamamlandı`
                  : "Henüz eser eklenmedi"}
              </p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
              <BookOpen className="size-3.5" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Akademik Görevler */}
        <Card className="border border-border bg-card">
          <CardContent className="flex items-center justify-between p-3">
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground truncate">
                Akademik Görevler
              </p>
              <p className="font-mono text-xs font-semibold tracking-tight text-foreground">
                {stats.activeTasks} Aktif
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {stats.completedTasks} tamamlanan adım
              </p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
              <CheckSquare className="size-3.5" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 4: Literatür Genişletme */}
        <Card className="border border-border bg-card">
          <CardContent className="flex items-center justify-between p-3">
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground truncate">
                Literatür Döngüsü
              </p>
              <p className="font-mono text-xs font-semibold tracking-tight text-foreground">
                Döngü #{stats.maxExpansionCycle}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {stats.anyReadyToExpand
                  ? "Genişletmeye hazır"
                  : "Kaynaklar inceleniyor"}
              </p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
              <Sparkles className="size-3.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 1: Topic Boxes */}
      <section className="space-y-6">
        <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border/60">
          <div>
            <h2 className="font-serif text-base font-semibold tracking-tight text-foreground">
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
