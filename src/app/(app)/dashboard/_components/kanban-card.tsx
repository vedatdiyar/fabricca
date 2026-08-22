"use client";

import { memo } from "react";
import Link from "next/link";
import {
  Pencil,
  Trash2,
  GripVertical,
  FolderKanban,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { KanbanTask } from "../_lib/types";
import { PRIORITY_CONFIG, TASK_TYPE_CONFIG } from "./kanban-config";

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
  const typeConfig = TASK_TYPE_CONFIG[task.taskType] ?? TASK_TYPE_CONFIG.MANUAL;
  const TypeIcon = typeConfig.icon ?? Sparkles;
  const priorityInfo = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.MEDIUM;

  const isCompleted = task.status === "DONE";

  return (
    <Card
      draggable="true"
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative rounded-lg border border-border/70 bg-card p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm cursor-grab active:cursor-grabbing select-none",
        isCompleted && "opacity-75 bg-muted/30",
      )}
    >
      <div className="flex flex-col gap-2.5">
        {/* Card Header: Type Badge + Priority Badge + Action Buttons in Top-Right */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-medium px-2 py-0.5 border rounded flex items-center gap-1",
                typeConfig.badgeClass,
              )}
            >
              <TypeIcon className="h-3 w-3 shrink-0" />
              <span>{typeConfig.label}</span>
            </Badge>

            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 border rounded",
                priorityInfo.className,
              )}
            >
              {priorityInfo.label}
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Direct Link to Source / Target Page in Top-Right */}
              {task.targetUrl && !isCompleted && (
                <Link
                  href={task.targetUrl}
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  title="Kaynağa / Eyleme Git"
                  aria-label="Kaynağa / Eyleme Git"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(task);
                }}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                title="Görevi Düzenle"
                aria-label="Görevi Düzenle"
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
                aria-label="Görevi Sil"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
          </div>
        </div>

        {/* Card Body: Icon + Title & Full Description */}
        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <TypeIcon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <h4
              className={cn(
                "font-sans text-xs sm:text-sm font-medium text-foreground leading-snug group-hover:text-primary transition-colors",
                isCompleted && "line-through text-muted-foreground",
              )}
            >
              {task.title}
            </h4>
          </div>
          {task.description && (
            <p className="font-sans text-xs text-muted-foreground leading-relaxed pl-6">
              {task.description}
            </p>
          )}
        </div>

        {/* Card Footer: Topic Box Title */}
        {task.boxTitle && (
          <div className="pt-2 border-t border-border/40 flex items-center gap-1.5 text-muted-foreground">
            <FolderKanban className="h-3 w-3 text-primary/80 shrink-0" />
            <span
              className="font-sans text-[11px] font-medium text-muted-foreground leading-normal truncate"
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
