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
  description: string;
  expansionCycle: number;
  isReadyToExpand: boolean;
  articles: DashboardJuryArticle[];
}

export interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "HIGH" | "MEDIUM" | "LOW";
  isReadingTask?: boolean;
  articleId?: string;
  thesisBoxId?: number | null;
  boxTitle?: string;
}
