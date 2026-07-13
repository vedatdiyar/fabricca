import { z } from "zod";

export const AddTaskSchema = z.object({
  title: z.string().min(1, "Task title is required."),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  thesisBoxId: z.number().nullable().optional(),
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(1, "Task title is required.").optional(),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  thesisBoxId: z.number().nullable().optional(),
});

export const TaskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "DONE"]);

export type TaskInput = z.infer<typeof AddTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export type TaskRow = {
  id: number;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "HIGH" | "MEDIUM" | "LOW";
  thesisBoxId: number | null;
  boxTitle: string | null;
  createdAt: Date;
  updatedAt: Date;
};
