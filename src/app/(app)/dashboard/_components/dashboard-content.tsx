"use client";

import type { ThesisBox, LibraryResource } from "@/db/schema";
import type { TaskRow } from "../_lib/schemas";
import { BoxCard } from "./box-card";
import { KanbanBoard } from "./kanban-board";
import { useDashboard } from "../_hooks/use-dashboard";

interface DashboardContentProps {
  initialBoxes: ThesisBox[];
  initialResources: LibraryResource[];
  initialTasks: TaskRow[];
}

export function DashboardContent({
  initialBoxes,
  initialResources,
  initialTasks,
}: DashboardContentProps) {
  const {
    topicBoxes,
    combinedTasks,
    handleTaskStatusChange,
    handleAddTask,
    handleEditTask,
    handleDeleteTask,
  } = useDashboard(initialBoxes, initialResources, initialTasks);

  return (
    <div className="w-full space-y-8">
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
