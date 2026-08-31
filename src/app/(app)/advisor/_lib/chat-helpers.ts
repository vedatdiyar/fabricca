import type { Message } from "@/core/db/schema";

/**
 * Builds a minimal chat history payload for the advisor API (last 6 messages).
 *
 * @param messages - Full message list.
 * @returns History payload with role/content pairs.
 */
export function buildHistoryPayload(
  messages: Pick<Message, "role" | "content">[],
): { role: "user" | "model" | "assistant"; content: string }[] {
  return messages.slice(-6).map((m) => ({
    role: m.role as "user" | "model" | "assistant",
    content: m.content,
  }));
}

/**
 * Builds optimistic user message for immediate UI feedback.
 *
 * @param sessionId - Target session ID.
 * @param content - Trimmed user input.
 * @returns Optimistic message.
 */
export function buildOptimisticUserMessage(
  sessionId: number,
  content: string,
): Message {
  return {
    id: Date.now(),
    sessionId,
    role: "user",
    content,
    persona: null,
    sources: null,
    toolCalls: null,
    pipelineData: null,
    createdAt: new Date(),
  };
}
