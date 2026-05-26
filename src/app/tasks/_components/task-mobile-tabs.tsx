"use client";

import React from "react";
import { TaskItem } from "../actions";
import { MobileTaskCard } from "./task-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export interface TaskMobileTabsProps {
  todoTasks: TaskItem[];
  doingTasks: TaskItem[];
  doneTasks: TaskItem[];
  onDelete: (id: number) => void;
  onUpdateStatus: (id: number, status: "todo" | "doing" | "done") => void;
}

export function TaskMobileTabs({
  todoTasks,
  doingTasks,
  doneTasks,
  onDelete,
  onUpdateStatus,
}: TaskMobileTabsProps) {
  return (
    <Tabs defaultValue="todo" className="md:hidden mb-6">
      <TabsList className="w-full bg-card border border-border p-1 rounded">
        <TabsTrigger value="todo" className="flex-1 cursor-pointer">
          Yapılacak ({todoTasks.length})
        </TabsTrigger>
        <TabsTrigger value="doing" className="flex-1 cursor-pointer">
          Çalışılıyor ({doingTasks.length})
        </TabsTrigger>
        <TabsTrigger value="done" className="flex-1 cursor-pointer">
          Tamamlandı ({doneTasks.length})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="todo" className="mt-4 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <span className="size-2 rounded-full bg-destructive" />
          <span>Yapılacak Hedefler ({todoTasks.length})</span>
        </h3>
        {todoTasks.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-xs text-muted-foreground bg-card">
            Bu sütunda henüz görev bulunmamaktadır.
          </div>
        ) : (
          todoTasks.map((task) => (
            <MobileTaskCard
              key={task.id}
              task={task}
              onDelete={onDelete}
              onUpdateStatus={onUpdateStatus}
            />
          ))
        )}
      </TabsContent>
      <TabsContent value="doing" className="mt-4 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary" />
          <span>Üzerinde Çalışılanlar ({doingTasks.length})</span>
        </h3>
        {doingTasks.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-xs text-muted-foreground bg-card">
            Aktif olarak üzerinde çalışılan bir hedef bulunmuyor.
          </div>
        ) : (
          doingTasks.map((task) => (
            <MobileTaskCard
              key={task.id}
              task={task}
              onDelete={onDelete}
              onUpdateStatus={onUpdateStatus}
            />
          ))
        )}
      </TabsContent>
      <TabsContent value="done" className="mt-4 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <span className="size-2 rounded-full bg-chart-5" />
          <span>Tamamlanan Görevler ({doneTasks.length})</span>
        </h3>
        {doneTasks.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-xs text-muted-foreground bg-card">
            Tamamlanmış bir görev henüz yok.
          </div>
        ) : (
          doneTasks.map((task) => (
            <MobileTaskCard
              key={task.id}
              task={task}
              onDelete={onDelete}
              onUpdateStatus={onUpdateStatus}
            />
          ))
        )}
      </TabsContent>
    </Tabs>
  );
}
