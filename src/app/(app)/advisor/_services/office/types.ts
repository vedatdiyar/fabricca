import type { OfficeReviewReport, PipelineResultData } from "../pipeline/types";

export interface OutlineOption {
  id: number;
  title: string;
  description: string | null;
  parentId: number | null;
  sortOrder: number;
}

export interface OfficeSessionSummary {
  id: number;
  title: string;
  outlineId: number | null;
  outlineTitle: string | null;
  draftText: string | null;
  studentNote: string | null;
  createdAt: string;
  messageCount: number;
}

export interface OfficeSessionDetail {
  id: number;
  title: string;
  outlineId: number | null;
  outlineTitle: string | null;
  outlineDescription: string | null;
  draftText: string | null;
  studentNote: string | null;
  reviewReport: OfficeReviewReport | null;
  messages: Array<{
    id: number;
    role: string;
    persona: string | null;
    content: string;
    createdAt: string;
    pipelineData: PipelineResultData | null;
  }>;
}
