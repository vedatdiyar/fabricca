/**
 * Dashboard domain types for Fabricca.
 */

export interface DashboardJuryArticle {
  id: string;
  title: string;
  author: string;
  year: number;
  isRead: boolean;
}

export interface TopicBox {
  id: string;
  title: string;
  description: string;
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
