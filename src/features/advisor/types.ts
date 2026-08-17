/** Structure for stored tool call requests in chat messages. */
export interface ChatToolCall {
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
  explanation: string;
  status: "pending" | "approved" | "rejected" | "undone";
  executionResult?: unknown;
  previousState?: Record<string, unknown>;
}
