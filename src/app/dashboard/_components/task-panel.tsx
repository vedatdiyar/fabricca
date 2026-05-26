"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  ListTodo,
  Plus,
  Calendar,
  Loader2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { format, parse } from "date-fns";
import { TaskItem } from "@/app/tasks/actions";

interface TaskPanelProps {
  tasks: TaskItem[];
  updatingTaskId: number | null;
  onUpdateStatus: (
    taskId: number,
    newStatus: "todo" | "doing" | "done",
  ) => void | Promise<void>;
}

export function TaskPanel({
  tasks,
  updatingTaskId,
  onUpdateStatus,
}: TaskPanelProps) {
  const router = useRouter();

  // Helper to format task due dates
  const formatTaskDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return format(parse(dateStr, "yyyy-MM-dd", new Date()), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  const activeTasks = tasks.filter(
    (t) => t.status === "todo" || t.status === "doing",
  );
  const completedTasks = tasks.filter((t) => t.status === "done");

  return (
    <div className="w-full border border-border bg-card p-6 rounded-lg shadow-xl space-y-6 mb-8">
      <div className="flex flex-row items-center justify-between gap-4 w-full pb-4 border-b border-border">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <ListTodo className="size-5 text-primary" />
            <span>Aktif Araştırma Planı ve Görevler</span>
          </h2>
          <p className="text-xs text-muted-foreground font-sans mt-0.5">
            Haftalık çalışma planınızdaki aktif hedefler ve yazım aşamaları
          </p>
        </div>
        <button
          onClick={() => router.push("/tasks")}
          className="text-xs font-semibold whitespace-nowrap bg-accent text-accent-foreground border border-border px-3.5 py-2 rounded hover:bg-background transition cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <Plus className="size-3.5 text-primary" />
          <span>Görev Ekle / Yönet</span>
        </button>
      </div>

      <div className="space-y-3">
        {activeTasks.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg py-10 text-center text-xs text-muted-foreground flex flex-col justify-center items-center gap-3">
            <ListTodo className="size-8 text-muted-foreground" />
            <div>
              <p className="font-semibold text-foreground">
                Aktif Araştırma Görevi Bulunmuyor
              </p>
              <p className="text-[11px] mt-1">
                Süreci ilerletmek için hemen bir araştırma hedefi veya makale
                inceleme görevi ekleyin.
              </p>
            </div>
          </div>
        ) : (
          activeTasks.map((task) => (
            <div
              key={task.id}
              className="bg-background border border-border p-4 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-primary transition duration-150 relative overflow-hidden"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {task.dueDate && (
                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                      <Calendar className="size-3 text-primary" />
                      <span>{formatTaskDate(task.dueDate)}</span>
                    </div>
                  )}
                  <span
                    className={`text-[9px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                      task.status === "doing"
                        ? "bg-secondary text-primary border-primary animate-pulse"
                        : "bg-secondary text-muted-foreground border-border"
                    }`}
                  >
                    {task.status === "doing" ? "Çalışılıyor" : "Yapılacak"}
                  </span>
                </div>
                <p className="text-xs font-sans text-foreground whitespace-pre-wrap leading-relaxed">
                  {task.taskDescription}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {updatingTaskId === task.id ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <>
                    {task.status === "todo" && (
                      <button
                        onClick={() => onUpdateStatus(task.id, "doing")}
                        className="flex items-center gap-1.5 text-[10px] font-semibold text-primary bg-accent hover:bg-background border border-border px-3 py-1.5 rounded transition duration-150 cursor-pointer"
                      >
                        <span>Başla</span>
                        <ArrowRight className="size-3" />
                      </button>
                    )}

                    {task.status === "doing" && (
                      <>
                        <button
                          onClick={() => onUpdateStatus(task.id, "todo")}
                          className="text-[10px] font-semibold text-muted-foreground hover:text-foreground bg-accent border border-border px-2.5 py-1.5 rounded transition duration-150 cursor-pointer"
                          title="Geri Al"
                        >
                          <ArrowLeft className="size-3" />
                        </button>
                        <button
                          onClick={() => onUpdateStatus(task.id, "done")}
                          className="flex items-center gap-1.5 text-[10px] font-semibold text-primary bg-accent hover:bg-background border border-border px-3 py-1.5 rounded transition duration-150 cursor-pointer"
                        >
                          <span>Tamamla</span>
                          <CheckCircle2 className="size-3" />
                        </button>
                      </>
                    )}

                    {task.status === "done" && (
                      <button
                        onClick={() => onUpdateStatus(task.id, "doing")}
                        className="text-[10px] font-semibold text-muted-foreground hover:text-foreground bg-accent border border-border px-2.5 py-1.5 rounded transition duration-150 cursor-pointer"
                        title="Geri Al"
                      >
                        <ArrowLeft className="size-3" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Tamamlanan görevler alt bölümü */}
      {completedTasks.length > 0 && (
        <div className="border-t border-border pt-4 space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="size-4 text-chart-5" />
            <span>Son Tamamlanan Araştırma Görevleri</span>
          </h3>
          {completedTasks.slice(0, 3).map((task) => (
            <div
              key={task.id}
              className="bg-background border border-border p-3.5 rounded-lg flex items-center justify-between gap-4"
            >
              <p className="text-xs font-sans text-muted-foreground line-clamp-1 line-through flex-1">
                {task.taskDescription}
              </p>
              <button
                onClick={() => onUpdateStatus(task.id, "doing")}
                className="text-[9px] font-bold text-primary bg-accent hover:bg-background border border-border px-2 py-1 rounded transition duration-150 cursor-pointer shrink-0"
              >
                Geri Al
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
