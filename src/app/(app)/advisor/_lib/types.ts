import type { RagSearchResultItem } from "@/core/services/search/rag-search";
import type { PipelineResult } from "@/app/(app)/advisor/_services/pipeline/types";
import type { AdvisorPersona } from "@/app/(app)/advisor/_services/classifier";

export interface PendingToolCall {
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
  explanation: string;
  status: "pending" | "approved" | "rejected" | "undone";
  executionResult?: unknown;
  previousState?: Record<string, unknown>;
}

/** Stored tool call request shape attached to chat messages. Alias of PendingToolCall. */
export type ChatToolCall = PendingToolCall;

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
