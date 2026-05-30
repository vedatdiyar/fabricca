"use client";

import React from "react";
import { ListTodo, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { type ThesisCoreData } from "../actions";

// Modular Subcomponents
import { DashboardLoading } from "./dashboard-loading";
import { ThesisConstitution } from "./thesis-constitution";
import { RecommendationGrid } from "./recommendation-grid";
import { PdfUploadDrawer } from "./pdf-upload-drawer";
import { TaskForm } from "./task-form";
import { TaskKanban } from "./task-kanban";
import { TaskMobileTabs } from "./task-mobile-tabs";
import { DashboardHeader } from "./dashboard-header";
import { MissingThesisConstitution } from "./missing-thesis-constitution";
import { useDashboard } from "../_hooks/use-dashboard";

interface DashboardClientProps {
  initialThesisData: ThesisCoreData | null;
}

export default function DashboardClient({
  initialThesisData,
}: DashboardClientProps) {
  const thesisData = initialThesisData;

  const {
    state,
    mounted,
    todoTasks,
    doingTasks,
    doneTasks,
    handleCreateTask,
    handleUpdateStatus,
    handleDeleteTask,
    handleDragEnd,
    fetchRecommendations,
    setTaskDescription,
    setTaskDueDate,
    setIsTasksCollapsed,
    setSelectedRec,
  } = useDashboard(initialThesisData);

  const {
    recs,
    isLoading,
    isLoadingRecs,
    error,
    recsError,
    selectedRec,
    tasksLoading,
    taskSubmitting,
    taskDescription,
    taskDueDate,
    tasksError,
    isTasksCollapsed,
  } = state;

  // If loading or an error occurs, show full-screen message
  if (isLoading || error) {
    return (
      <DashboardLoading
        isLoading={isLoading}
        error={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground p-6 md:p-10 pb-24 md:pb-10 overflow-y-auto">
      {/* Header */}
      <DashboardHeader />

      {/* TEZ ANAYASASI */}
      {thesisData ? (
        <ThesisConstitution thesisData={thesisData} />
      ) : (
        <MissingThesisConstitution />
      )}

      {/* LİTERATÜR TAVSİYELERİ */}
      <RecommendationGrid
        recs={recs}
        boxes={thesisData?.boxes || []}
        isLoadingRecs={isLoadingRecs}
        recsError={recsError}
        onRefresh={(boxId) =>
          thesisData && fetchRecommendations(thesisData, true, boxId)
        }
        onSelectRec={(rec) => setSelectedRec(rec)}
      />

      {/* GÖREVLER KANBAN PANOSU */}
      <div className="w-full mb-8 border border-border bg-card rounded-lg overflow-hidden transition-all duration-300">
        {/* Panel Header */}
        <div className="p-5 border-b border-border flex justify-between items-center bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-primary/10 text-primary">
              <ListTodo className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
                <span>Aktif Araştırma Planı ve Görevler</span>
              </h2>
              <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                Haftalık araştırma hedeflerinizi organize edin ve durumlarını
                takip edin
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsTasksCollapsed(!isTasksCollapsed)}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
            title={isTasksCollapsed ? "Genişlet" : "Daralt"}
          >
            {isTasksCollapsed ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronUp className="size-4" />
            )}
          </button>
        </div>

        {/* Panel Content (Collapsible) */}
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            isTasksCollapsed
              ? "max-h-0 opacity-0"
              : "max-h-[2500px] opacity-100"
          }`}
        >
          <div className="p-6 space-y-6 bg-card">
            {tasksLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="size-8 text-primary animate-spin" />
                <p className="text-xs text-muted-foreground mt-3 font-sans">
                  Görevler yükleniyor...
                </p>
              </div>
            ) : (
              <>
                <TaskMobileTabs
                  todoTasks={todoTasks}
                  doingTasks={doingTasks}
                  doneTasks={doneTasks}
                  onDelete={handleDeleteTask}
                  onUpdateStatus={handleUpdateStatus}
                />
                <TaskKanban
                  mounted={mounted}
                  todoTasks={todoTasks}
                  doingTasks={doingTasks}
                  doneTasks={doneTasks}
                  onDragEnd={handleDragEnd}
                  onDelete={handleDeleteTask}
                />
              </>
            )}

            <div className="border-t border-border pt-4" />

            <TaskForm
              description={taskDescription}
              setDescription={setTaskDescription}
              dueDate={taskDueDate}
              setDueDate={setTaskDueDate}
              submitting={taskSubmitting}
              errorMessage={tasksError}
              onSubmit={handleCreateTask}
            />
          </div>
        </div>
      </div>

      {/* PDF YÜKLEME PANELİ */}
      <PdfUploadDrawer
        selectedRec={selectedRec}
        onClose={() => setSelectedRec(null)}
      />
    </div>
  );
}
