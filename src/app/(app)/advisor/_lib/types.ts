import type { RagSearchResultItem } from "@/core/services/search/rag-search";
import type { PipelineResult } from "@/core/types/jsonb";
import type { AdvisorPersona } from "@/app/(app)/advisor/_services/classifier";
import type {
  PendingToolCall as CorePendingToolCall,
  ChatToolCall as CoreChatToolCall,
} from "@/core/types/jsonb";

export type PendingToolCall = CorePendingToolCall;

/** Stored tool call request shape attached to chat messages. Alias of PendingToolCall. */
export type ChatToolCall = CoreChatToolCall;

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
