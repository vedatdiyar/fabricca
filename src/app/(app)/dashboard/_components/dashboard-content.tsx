"use client";

import type { Box, Source } from "@/db/schema";
import type { TaskRow } from "../_lib/schemas";
import { Card } from "@/components/ui/card";
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
 * Renders the interactive dashboard with topic boxes and the Kanban board.
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

  return (
    <div className="w-full space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
            Konu Kutuları ve Okuma Listeleri
          </h2>
          <p className="font-sans text-sm text-muted-foreground mt-1">
            Araştırma alanlarınıza önerilen akademik kaynaklar. Okundukça yerini
            yedek kaynaklara bırakır.
          </p>
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

      <div className="border-t border-border/40 my-8" />

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
