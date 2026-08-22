"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  RefreshCw,
  Sparkles,
  AlertCircle,
  BookOpen,
  PenTool,
  Layers,
  GraduationCap,
  ListFilter,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Box, TaskType } from "@/core/db/schema";
import type { KanbanTask } from "../_lib/types";
import type { TaskInput } from "../_lib/schemas";
import type { StrategistAuditResult } from "../_services/task-strategist-service";
import { AddTaskModal } from "./add-task-modal";
import { EditTaskModal } from "./edit-task-modal";
import { COLUMNS, TASK_TYPE_CONFIG } from "./kanban-config";
import { KanbanColumn } from "./kanban-column";

interface KanbanBoardProps {
  tasks: KanbanTask[];
  isSyncing?: boolean;
  isAuditing?: boolean;
  onTaskStatusChange: (
    taskId: string,
    newStatus: "TODO" | "IN_PROGRESS" | "DONE",
  ) => void;
  onAddTask: (task: TaskInput) => Promise<boolean> | void;
  onEditTask: (
    taskId: string,
    input: {
      title: string;
      priority: "HIGH" | "MEDIUM" | "LOW";
      taskType?: TaskType;
      thesisBoxId?: number | null;
    },
  ) => Promise<boolean>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onSyncTasks?: () => Promise<void>;
  onRunStrategistAudit?: () => Promise<StrategistAuditResult | null>;
  boxes: Box[];
}

type FilterType = "ALL" | TaskType;

interface FilterOption {
  id: FilterType;
  label: string;
  count: number;
  icon: LucideIcon;
}

/**
 * Renders the Academic Kanban board with ADHD-friendly category filters,
 * Gemini Flash strategist audits, and drag-and-drop mechanics.
 *
 * @param props - Component props.
 * @returns The rendered Kanban board.
 */
export function KanbanBoard({
  tasks,
  isSyncing = false,
  isAuditing = false,
  onTaskStatusChange,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onSyncTasks,
  onRunStrategistAudit,
  boxes,
}: KanbanBoardProps) {
  const [activeDragCol, setActiveDragCol] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("ALL");
  const [auditResult, setAuditResult] = useState<StrategistAuditResult | null>(
    null,
  );

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setActiveDragCol(colId);
  };

  const handleDrop = (
    e: React.DragEvent,
    targetStatus: "TODO" | "IN_PROGRESS" | "DONE",
  ) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    onTaskStatusChange(taskId, targetStatus);
    setActiveDragCol(null);
  };

  const handleAuditClick = async () => {
    if (!onRunStrategistAudit) return;
    const result = await onRunStrategistAudit();
    if (result) {
      setAuditResult(result);
    }
  };

  // Filter tasks based on category selection
  const filteredTasks = useMemo(() => {
    if (activeFilter === "ALL") return tasks;
    return tasks.filter((t) => t.taskType === activeFilter);
  }, [tasks, activeFilter]);

  const todoTasks = useMemo(
    () => filteredTasks.filter((t) => t.status === "TODO"),
    [filteredTasks],
  );
  const inProgressTasks = useMemo(
    () => filteredTasks.filter((t) => t.status === "IN_PROGRESS"),
    [filteredTasks],
  );
  const doneTasks = useMemo(
    () => filteredTasks.filter((t) => t.status === "DONE"),
    [filteredTasks],
  );

  const getColumnTasks = useMemo(
    () => ({
      TODO: todoTasks,
      IN_PROGRESS: inProgressTasks,
      DONE: doneTasks,
    }),
    [todoTasks, inProgressTasks, doneTasks],
  );

  const filterOptions: FilterOption[] = [
    {
      id: "ALL",
      label: "Tümü",
      count: tasks.length,
      icon: ListFilter,
    },
    {
      id: "READING",
      label: "Kaynak Okuma",
      count: tasks.filter((t) => t.taskType === "READING").length,
      icon: BookOpen,
    },
    {
      id: "NOTE_TAKING",
      label: "Not & Alıntı",
      count: tasks.filter((t) => t.taskType === "NOTE_TAKING").length,
      icon: PenTool,
    },
    {
      id: "CARD_SORTING",
      label: "Fiş Tasnifi",
      count: tasks.filter((t) => t.taskType === "CARD_SORTING").length,
      icon: Layers,
    },
    {
      id: "ADVISOR_REQUEST",
      label: "Danışman",
      count: tasks.filter((t) => t.taskType === "ADVISOR_REQUEST").length,
      icon: GraduationCap,
    },
    {
      id: "MANUAL",
      label: "Kişisel",
      count: tasks.filter((t) => t.taskType === "MANUAL").length,
      icon: Sparkles,
    },
  ];

  return (
    <div className="w-full space-y-5">
      {/* Board Header */}
      <div className="flex w-full flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-serif text-base font-semibold tracking-tight text-foreground">
              Akademik Kanban Panosu
            </h2>
            <Badge
              variant="outline"
              className="border-primary/20 bg-primary/5 text-primary"
            >
              ADHD Denge Motoru Aktif
            </Badge>
          </div>
          <p className="font-sans text-xs text-muted-foreground mt-1">
            Okuma, not çıkarma, fiş tasnifi ve danışman taleplerinizi dengeli
            şekilde yürütün.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {onRunStrategistAudit && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAuditClick}
              disabled={isAuditing}
              className="border-primary/30 text-primary hover:bg-primary/5"
            >
              <Sparkles
                className={`size-3.5 ${isAuditing ? "animate-spin" : ""}`}
              />
              <span>
                {isAuditing ? "Analiz Ediliyor..." : "Strateji Analizi"}
              </span>
            </Button>
          )}

          {onSyncTasks && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncTasks}
              disabled={isSyncing}
            >
              <RefreshCw
                className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`}
              />
              <span>{isSyncing ? "Taranıyor..." : "Senkronize Et"}</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>Yeni Görev</span>
          </Button>
        </div>
      </div>

      {/* Strategist AI Insight Banner (if generated) */}
      {auditResult && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-primary shrink-0" />
              <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground">
                Tez Stratejisti Durum Analizi
              </h3>
            </div>
            <Badge
              variant="outline"
              className="bg-card border-primary/20 text-primary"
            >
              Öncelikli Alan:{" "}
              {TASK_TYPE_CONFIG[
                auditResult.actionSteps[0]?.taskType ?? "MANUAL"
              ]?.label ?? "Metodoloji"}
            </Badge>
          </div>
          <p className="font-sans text-xs text-foreground leading-relaxed">
            {auditResult.analysisSummary}
          </p>
          <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span>
              <strong>Kritik Darboğaz:</strong> {auditResult.primaryBottleneck}
            </span>
          </div>
        </div>
      )}

      {/* ADHD Filter Bar with Icons */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {filterOptions.map((f) => {
          const FilterIcon = f.icon;
          const isActive = activeFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveFilter(f.id)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-sans transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground font-medium shadow-xs"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <FilterIcon className="h-3.5 w-3.5 shrink-0" />
              <span>{f.label}</span>
              <span
                className={`text-[10px] px-1 py-0.2 rounded ${
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {f.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Columns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={getColumnTasks[col.id]}
            isDragActive={activeDragCol === col.id}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDrop={handleDrop}
            onDragStart={handleDragStart}
            onDragEnd={() => setActiveDragCol(null)}
            onEdit={(task) => setEditingTask(task)}
            onDelete={onDeleteTask}
          />
        ))}
      </div>

      {/* Modals */}
      <AddTaskModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={onAddTask}
        boxes={boxes}
      />

      <EditTaskModal
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onEdit={onEditTask}
        boxes={boxes}
      />
    </div>
  );
}
