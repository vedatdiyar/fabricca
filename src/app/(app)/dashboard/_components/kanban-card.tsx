"use client";

import { memo } from "react";
import {
  BookOpen,
  Sparkles,
  Pencil,
  Trash2,
  GripVertical,
  FolderKanban,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { KanbanTask } from "../_lib/types";
import { PRIORITY_CONFIG } from "./kanban-config";

export interface KanbanCardProps {
  task: KanbanTask;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: () => void;
  onEdit: (task: KanbanTask) => void;
  onDelete: (taskId: string) => void;
}

export const KanbanCard = memo(function KanbanCard({
  task,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
}: KanbanCardProps) {
  const isReading = task.isReadingTask;
  const priorityInfo = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.MEDIUM;

  return (
    <Card
      draggable="true"
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      className="group relative rounded-md border border-border/60 bg-card p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xs cursor-grab active:cursor-grabbing select-none"
    >
      <div className="flex flex-col gap-2.5">
        {/* Card Header: Type / Priority Badge + Hover Actions + Drag Handle */}
        <div className="flex items-center justify-between gap-2">
          <div>
            {isReading ? (
              <Badge
                variant="outline"
                className="text-[10px] font-medium px-2 py-0.5 border-emerald-500/20 bg-emerald-500/10 text-emerald-400 rounded"
              >
                Okuma Görevi
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 border rounded",
                  priorityInfo.className,
                )}
              >
                {priorityInfo.label}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            {!isReading && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(task);
                  }}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
                  title="Görevi Düzenle"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      window.confirm(
                        `"${task.title}" görevini silmek istediğinize emin misiniz?`,
                      )
                    ) {
                      onDelete(task.id);
                    }
                  }}
                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Görevi Sil"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
          </div>
        </div>

        {/* Card Body: Icon + Title + Description */}
        <div className="flex items-start gap-2.5">
          {isReading ? (
            <BookOpen className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
          ) : (
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          )}
          <div className="space-y-1 min-w-0 flex-1">
            <h4 className="font-sans text-xs sm:text-sm font-medium text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
              {task.title}
            </h4>
            {task.description && (
              <p className="font-sans text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {task.description}
              </p>
            )}
          </div>
        </div>

        {/* Card Footer: Topic Box Title with full available width without clipping */}
        {task.boxTitle && (
          <div className="pt-2 border-t border-border/40 flex items-center gap-1.5 text-muted-foreground">
            <FolderKanban className="h-3 w-3 text-primary shrink-0" />
            <span
              className="font-sans text-[11px] font-medium text-primary/90 leading-normal break-words"
              title={task.boxTitle}
            >
              {task.boxTitle}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
});
