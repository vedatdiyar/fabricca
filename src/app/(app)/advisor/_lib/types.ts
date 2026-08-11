import type { RagSearchResultItem } from "@/lib/services/rag-search";
import type { PipelineResult } from "@/lib/services/advisor-pipeline/types";
import type { AdvisorPersona } from "@/lib/services/advisor-classifier";

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
