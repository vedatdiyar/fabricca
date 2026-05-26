"use client";

import React from "react";
import { TaskItem } from "../actions";
import {
  Calendar,
  Trash2,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
} from "lucide-react";
import { format, parse } from "date-fns";

export interface TaskCardProps {
  task: TaskItem;
  onDelete: (id: number) => void;
}

export function TaskCard({ task, onDelete }: TaskCardProps) {
  return (
    <div className="bg-card p-4 flex flex-col justify-between space-y-3">
      <div className="space-y-2">
        <p className="text-sm font-sans text-foreground whitespace-pre-wrap leading-relaxed">
          {task.taskDescription}
        </p>
        {task.dueDate && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded w-fit border border-border">
            <Calendar className="size-3 text-primary" />
            <span>
              {format(
                parse(task.dueDate, "yyyy-MM-dd", new Date()),
                "dd/MM/yyyy",
              )}
            </span>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-border mt-2 flex justify-end">
        <button
          onClick={() => onDelete(task.id)}
          className="text-muted-foreground hover:text-destructive p-1 rounded transition duration-150 cursor-pointer"
          title="Görevi Sil"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

export interface MobileTaskCardProps {
  task: TaskItem;
  onDelete: (id: number) => void;
  onUpdateStatus: (id: number, status: "todo" | "doing" | "done") => void;
}

export function MobileTaskCard({
  task,
  onDelete,
  onUpdateStatus,
}: MobileTaskCardProps) {
  return (
    <div className="bg-card border border-border p-4 rounded shadow-sm hover:border-primary transition duration-150 flex flex-col justify-between space-y-3">
      <div className="space-y-2">
        <p className="text-sm font-sans text-foreground whitespace-pre-wrap leading-relaxed">
          {task.taskDescription}
        </p>
        {task.dueDate && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded w-fit border border-border">
            <Calendar className="size-3 text-primary" />
            <span>
              {format(
                parse(task.dueDate, "yyyy-MM-dd", new Date()),
                "dd/MM/yyyy",
              )}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
        <button
          onClick={() => onDelete(task.id)}
          className="text-muted-foreground hover:text-destructive p-1 rounded transition duration-150 cursor-pointer"
          title="Görevi Sil"
        >
          <Trash2 className="size-4" />
        </button>

        <div className="flex items-center gap-1">
          {task.status === "todo" && (
            <button
              onClick={() => onUpdateStatus(task.id, "doing")}
              className="flex items-center gap-1 text-[10px] font-sans font-medium text-primary hover:bg-accent px-2 py-1 rounded transition duration-150 border border-border bg-background cursor-pointer"
            >
              <span>Başla</span>
              <ArrowRight className="size-3" />
            </button>
          )}

          {task.status === "doing" && (
            <>
              <button
                onClick={() => onUpdateStatus(task.id, "todo")}
                className="text-muted-foreground hover:text-foreground p-1 rounded transition duration-150 border border-border bg-background cursor-pointer"
                title="Geri Al"
              >
                <ArrowLeft className="size-3.5" />
              </button>
              <button
                onClick={() => onUpdateStatus(task.id, "done")}
                className="flex items-center gap-1 text-[10px] font-sans font-medium text-primary hover:bg-accent px-2 py-1 rounded transition duration-150 border border-border bg-background cursor-pointer"
              >
                <span>Tamamla</span>
                <CheckCircle className="size-3" />
              </button>
            </>
          )}

          {task.status === "done" && (
            <button
              onClick={() => onUpdateStatus(task.id, "doing")}
              className="flex items-center gap-1 text-[10px] font-sans font-medium text-muted-foreground hover:text-foreground hover:bg-accent px-2 py-1 rounded transition duration-150 border border-border bg-background cursor-pointer"
            >
              <ArrowLeft className="size-3" />
              <span>Geri Al</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
