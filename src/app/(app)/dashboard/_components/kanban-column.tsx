"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KanbanTask } from "../_lib/types";
import { COLUMNS } from "./kanban-config";
import { KanbanCard } from "./kanban-card";

export interface KanbanColumnProps {
  column: (typeof COLUMNS)[number];
  tasks: KanbanTask[];
  isDragActive: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnter: (e: React.DragEvent, colId: string) => void;
  onDrop: (
    e: React.DragEvent,
    targetStatus: "TODO" | "IN_PROGRESS" | "DONE",
  ) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: () => void;
  onEdit: (task: KanbanTask) => void;
  onDelete: (taskId: string) => void;
}

/**
 * Renders a single Kanban column containing task cards and drop target handling.
 *
 * @param props - Column configuration, task list, and event handlers.
 * @returns Rendered column element.
 */
export function KanbanColumn({
  column,
  tasks,
  isDragActive,
  onDragOver,
  onDragEnter,
  onDrop,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
}: KanbanColumnProps) {
  const [showAllDone, setShowAllDone] = useState(false);
  const ColIcon = column.icon;

  return (
    <div
      onDragOver={onDragOver}
      onDragEnter={(e) => onDragEnter(e, column.id)}
      onDrop={(e) => onDrop(e, column.id)}
      className={cn(
        "flex flex-col gap-4 rounded-md border p-4 min-h-[360px] transition-all duration-200",
        isDragActive
          ? "border-primary/40 bg-primary/10 ring-1 ring-primary/20 scale-[1.01]"
          : "border-border/60 bg-muted/20",
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md border",
              column.badgeColor,
            )}
          >
            <ColIcon className="h-4 w-4" />
          </div>
          <h3 className="font-serif text-base font-semibold tracking-tight text-foreground">
            {column.label}
          </h3>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "font-sans text-xs font-semibold px-2 py-0.5 rounded-md border",
            column.badgeColor,
          )}
        >
          {tasks.length}
        </Badge>
      </div>

      {/* Task Cards List */}
      <div className="flex flex-col gap-3 p-0.5 overflow-visible flex-1">
        {tasks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-12 px-4 rounded-md border border-dashed border-border/40 bg-secondary/10 text-center">
            <p className="text-xs text-muted-foreground font-medium">
              Bu aşamada görev bulunmuyor.
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {column.id === "TODO"
                ? "Yukarıdaki butondan yeni bir araştırma adımı ekleyebilirsiniz."
                : "Görevleri buraya sürükleyip bırakabilirsiniz."}
            </p>
          </div>
        ) : (
          <>
            {(column.id === "DONE" ? tasks.slice(0, 5) : tasks).map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}

            {column.id === "DONE" && tasks.length > 5 && (
              <>
                <div
                  className={cn(
                    "flex flex-col gap-3 transition-all duration-300 ease-in-out overflow-hidden",
                    showAllDone
                      ? "max-h-max opacity-100 mt-1"
                      : "max-h-0 opacity-0 pointer-events-none",
                  )}
                >
                  {tasks.slice(5).map((task) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                </div>

                <Button
                  variant="outline"
                  onClick={() => setShowAllDone(!showAllDone)}
                  className="w-full mt-2 border-dashed border-border/40 text-muted-foreground hover:text-foreground text-xs font-sans rounded-md py-2 flex items-center justify-center gap-2"
                >
                  {showAllDone ? (
                    <>
                      <span>Daha Az Göster</span>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Tüm Tamamlananları Gör (+{tasks.length - 5})</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
