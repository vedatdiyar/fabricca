"use client";

import { useState, useMemo } from "react";
import { FolderKanban, BookOpen, CheckSquare, Sparkles } from "lucide-react";
import type { Box, Source } from "@/core/db/schema";
import type { TaskRow } from "../_lib/schemas";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MetricCard } from "@/components/shared/metrics/metric-card";
import { MetricsGrid } from "@/components/shared/metrics/metrics-grid";
import { BoxCard } from "./box-card";
import { KanbanBoard } from "./kanban-board";
import { AcademicTimelineBar } from "./academic-timeline-bar";
import { useDashboard } from "../_hooks/use-dashboard";
import type { TimelineMetrics } from "@/core/services/timeline/timeline-engine";

interface DashboardContentProps {
  initialBoxes: Box[];
  initialResources: Source[];
  initialTasks: TaskRow[];
  childIdToParentId: Map<number, number>;
  allBoxRows: Box[];
  initialTimelineMetrics?: TimelineMetrics | null;
}

/**
 * Renders the interactive dashboard with topic boxes, overview metrics, academic timeline bar, and the Kanban board.
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
  initialTimelineMetrics,
}: DashboardContentProps) {
  const [timelineMetrics, setTimelineMetrics] =
    useState<TimelineMetrics | null>(initialTimelineMetrics ?? null);

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
    <div className="w-full space-y-6">
      {/* Academic Timeline Progress Bar */}
      <AcademicTimelineBar
        metrics={timelineMetrics}
        onMetricsUpdated={setTimelineMetrics}
      />

      {/* Overview Metric Cards */}
      <MetricsGrid>
        <MetricCard
          label="Konu Kutuları"
          value={stats.totalBoxes}
          subtext="Aktif araştırma teması"
          icon={FolderKanban}
        />
        <MetricCard
          label="Okuma İlerlemesi"
          value={`${stats.readArticles} / ${stats.totalArticles}`}
          subtext={
            stats.totalArticles > 0
              ? `%${stats.readPercentage} tamamlandı`
              : "Henüz eser eklenmedi"
          }
          icon={BookOpen}
        />
        <MetricCard
          label="Akademik Görevler"
          value={`${stats.activeTasks} Aktif`}
          subtext={`${stats.completedTasks} tamamlanan adım`}
          icon={CheckSquare}
        />
        <MetricCard
          label="Literatür Döngüsü"
          value={`Döngü #${stats.maxExpansionCycle}`}
          subtext={
            stats.anyReadyToExpand ? "Genişletmeye hazır" : "Kaynaklar inceleniyor"
          }
          icon={Sparkles}
        />
      </MetricsGrid>

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
      <Separator className="my-8 bg-border/40" />

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
