"use client";

import React from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { TaskItem } from "../_actions/tasks";
import { TaskCard } from "./task-card";

export interface TaskKanbanProps {
  mounted: boolean;
  todoTasks: TaskItem[];
  doingTasks: TaskItem[];
  doneTasks: TaskItem[];
  onDragEnd: (result: DropResult) => void;
  onDelete: (id: number) => void;
}

export function TaskKanban({
  mounted,
  todoTasks,
  doingTasks,
  doneTasks,
  onDragEnd,
  onDelete,
}: TaskKanbanProps) {
  const renderColumn = (
    droppableId: "todo" | "doing" | "done",
    title: string,
    columnTasks: TaskItem[],
    indicatorClass: string,
    pulse?: boolean,
  ) => {
    const emptyLabels: Record<string, string> = {
      todo: "Görev bulunmuyor",
      doing: "Çalışılan görev yok",
      done: "Tamamlanan görev yok",
    };

    return (
      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`border border-border bg-card rounded-lg p-4 flex flex-col space-y-4 h-full min-h-[500px] transition duration-150 ${
              snapshot.isDraggingOver ? "bg-accent" : ""
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <span
                  className={`size-2 rounded-full ${indicatorClass} ${pulse ? "animate-pulse" : ""}`}
                />
                <span>{title}</span>
              </h3>
              <span className="text-[10px] font-sans text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                {columnTasks.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {columnTasks.length === 0 ? (
                <div className="border border-dashed border-border rounded-lg py-12 text-center text-xs text-muted-foreground">
                  {emptyLabels[droppableId]}
                </div>
              ) : (
                columnTasks.map((task, index) => (
                  <Draggable
                    key={task.id}
                    draggableId={String(task.id)}
                    index={index}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`rounded transition duration-150 border cursor-grab ${
                          snapshot.isDragging
                            ? "border-primary shadow-xl cursor-grabbing"
                            : "border-border"
                        }`}
                      >
                        <TaskCard task={task} onDelete={onDelete} />
                      </div>
                    )}
                  </Draggable>
                ))
              )}
              {provided.placeholder}
            </div>
          </div>
        )}
      </Droppable>
    );
  };

  if (!mounted) {
    return (
      <div className="hidden md:grid grid-cols-3 gap-6 flex-1">
        {/* Todo Fallback Column */}
        <div className="border border-border bg-card rounded-lg p-4 flex flex-col space-y-4 h-full min-h-[500px]">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="size-2 rounded-full bg-destructive" />
              <span>Yapılacaklar</span>
            </h3>
            <span className="text-[10px] font-sans text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
              {todoTasks.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {todoTasks.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg py-12 text-center text-xs text-muted-foreground">
                Görev bulunmuyor
              </div>
            ) : (
              todoTasks.map((task) => (
                <div key={task.id} className="border border-border rounded">
                  <TaskCard task={task} onDelete={onDelete} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Doing Fallback Column */}
        <div className="border border-border bg-card rounded-lg p-4 flex flex-col space-y-4 h-full min-h-[500px]">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              <span>Çalışılanlar</span>
            </h3>
            <span className="text-[10px] font-sans text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
              {doingTasks.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {doingTasks.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg py-12 text-center text-xs text-muted-foreground">
                Çalışılan görev yok
              </div>
            ) : (
              doingTasks.map((task) => (
                <div key={task.id} className="border border-border rounded">
                  <TaskCard task={task} onDelete={onDelete} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Done Fallback Column */}
        <div className="border border-border bg-card rounded-lg p-4 flex flex-col space-y-4 h-full min-h-[500px]">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="size-2 rounded-full bg-chart-5" />
              <span>Tamamlananlar</span>
            </h3>
            <span className="text-[10px] font-sans text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
              {doneTasks.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {doneTasks.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg py-12 text-center text-xs text-muted-foreground">
                Tamamlanan görev yok
              </div>
            ) : (
              doneTasks.map((task) => (
                <div key={task.id} className="border border-border rounded">
                  <TaskCard task={task} onDelete={onDelete} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="hidden md:grid grid-cols-3 gap-6 flex-1">
        {renderColumn("todo", "Yapılacaklar", todoTasks, "bg-destructive")}
        {renderColumn("doing", "Çalışılanlar", doingTasks, "bg-primary", true)}
        {renderColumn("done", "Tamamlananlar", doneTasks, "bg-chart-5")}
      </div>
    </DragDropContext>
  );
}
