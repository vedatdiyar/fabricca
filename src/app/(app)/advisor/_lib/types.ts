import type { RagSearchResultItem } from "@/services/search/rag-search";
import type { PipelineResult } from "@/features/advisor/pipeline/types";
import type { AdvisorPersona } from "@/features/advisor/classifier";

export interface PendingToolCall {
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
  explanation: string;
  status: "pending" | "approved" | "rejected" | "undone";
  executionResult?: unknown;
  previousState?: Record<string, unknown>;
}

export interface Message {
  id: string;
  dbId?: number;
  role: "user" | "model";
  persona?: AdvisorPersona;
  content: string;
  sources?: RagSearchResultItem[];
  toolCalls?: PendingToolCall[];
  pipeline?: PipelineResult;
  timestamp: string;
}

export interface CitationPopoverContentProps {
  source: RagSearchResultItem;
}

export interface AdvisorChatProps {
  initialSessionId?: number;
}
