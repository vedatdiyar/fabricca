import type { RagSearchResultItem } from "@/lib/services/rag-search";
import type { PendingToolCall } from "./tool-confirmation-card";

export interface Message {
  id: string;
  dbId?: number;
  role: "user" | "model";
  persona?: "SOCRATIC_ADVISOR" | "TEZ_ASSISTANT";
  content: string;
  sources?: RagSearchResultItem[];
  toolCalls?: PendingToolCall[];
  timestamp: string;
}

export interface CitationPopoverContentProps {
  source: RagSearchResultItem;
}

export interface AdvisorChatProps {
  initialSessionId?: number;
}
