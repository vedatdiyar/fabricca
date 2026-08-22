import type { TaskType } from "@/core/db/schema";

/**
 * Dashboard domain types for Fabricca.
 */

export interface DashboardJuryArticle {
  id: string;
  title: string;
  author: string;
  year: number;
  isRead: boolean;
  /** Title of the sub-box this article belongs to, when linked to a child box. */
  subBoxTitle?: string;
}

export interface TopicBox {
  id: string;
  title: string;
  boxType?: string | null;
  description: string;
  expansionCycle: number;
  isReadyToExpand: boolean;
  articles: DashboardJuryArticle[];
}

export interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  taskType: TaskType;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "HIGH" | "MEDIUM" | "LOW";
  thesisBoxId?: number | null;
  boxTitle?: string;
  sourceId?: number | null;
  targetUrl?: string | null;
  isAutomated?: boolean;
  metadata?: Record<string, unknown> | null;
}
