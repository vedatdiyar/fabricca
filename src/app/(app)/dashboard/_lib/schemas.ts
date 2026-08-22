import { z } from "zod";
import type { TaskType } from "@/core/db/schema";

export const TaskTypeSchema = z.enum([
  "READING",
  "NOTE_TAKING",
  "CARD_SORTING",
  "BOX_GAP",
  "ADVISOR_REQUEST",
  "MANUAL",
]);

export const AddTaskSchema = z.object({
  title: z.string().min(1, "Task title is required."),
  description: z.string().optional(),
  taskType: TaskTypeSchema.optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  thesisBoxId: z.number().nullable().optional(),
  sourceId: z.number().nullable().optional(),
  targetUrl: z.string().nullable().optional(),
  isAutomated: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(1, "Task title is required.").optional(),
  description: z.string().optional(),
  taskType: TaskTypeSchema.optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  thesisBoxId: z.number().nullable().optional(),
  sourceId: z.number().nullable().optional(),
  targetUrl: z.string().nullable().optional(),
  isAutomated: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const TaskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "DONE"]);

export type TaskInput = z.infer<typeof AddTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export type TaskRow = {
  id: number;
  title: string;
  description: string | null;
  taskType: TaskType;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "HIGH" | "MEDIUM" | "LOW";
  thesisBoxId: number | null;
  boxTitle: string | null;
  sourceId: number | null;
  targetUrl: string | null;
  isAutomated: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};
