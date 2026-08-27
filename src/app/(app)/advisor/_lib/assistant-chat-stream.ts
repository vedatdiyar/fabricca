import type { ChatToolCall } from "@/core/db/schema";
import type { RagSearchResultItem } from "@/core/services/search/rag-search";
import { createStreamFlusher } from "./stream-flusher";

export interface AssistantChatStreamCallbacks {
  onPersona?: (persona: string) => void;
  onDelta?: (text: string) => void;
  onToolCalls?: (toolCalls: ChatToolCall[]) => void;
  onError?: (error: string) => void;
}

export interface AssistantChatStreamResult {
  finalResponseText: string;
  finalSources: RagSearchResultItem[];
  finalPersona: string;
  finalToolCalls: ChatToolCall[];
}

/**
 * Consumes the Server-Sent Events stream from the Advisor Chat endpoint.
 *
 * @param response - The active fetch Response object from /api/advisor.
 * @param callbacks - Event callbacks for persona assignment, incremental deltas, and tool calls.
 * @returns Fully assembled response text, citations, assigned persona, and tool call descriptors.
 */
export async function consumeAssistantChatStream(
  response: Response,
  callbacks: AssistantChatStreamCallbacks = {},
): Promise<AssistantChatStreamResult> {
  if (!response.body) {
    throw new Error("Yanıt akışı başlatılamadı.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const flusher = createStreamFlusher();
  let buffer = "";
  let finalResponseText = "";
  let finalSources: RagSearchResultItem[] = [];
  let finalPersona = "SOCRATIC_ADVISOR";
  let finalToolCalls: ChatToolCall[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";

      for (const block of lines) {
        const trimmedBlock = block.trim();
        if (!trimmedBlock.startsWith("data:")) continue;

        const jsonStr = trimmedBlock.replace(/^data:\s*/, "");
        if (jsonStr === "[DONE]") continue;

        try {
          const eventData = JSON.parse(jsonStr);

          if (eventData.type === "persona_assigned" && eventData.persona) {
            finalPersona = eventData.persona;
            callbacks.onPersona?.(eventData.persona);
          } else if (eventData.type === "delta" && eventData.text) {
            finalResponseText += eventData.text;
            flusher.schedule(() => callbacks.onDelta?.(finalResponseText));
          } else if (eventData.type === "tool_call_request") {
            const incomingToolCall: ChatToolCall = {
              toolCallId: eventData.toolCallId,
              name: eventData.name,
              args: eventData.args,
              explanation: eventData.explanation,
              status: eventData.status || "pending",
              previousState: eventData.previousState,
            };
            finalToolCalls = [...finalToolCalls, incomingToolCall];
            callbacks.onToolCalls?.(finalToolCalls);
          } else if (eventData.type === "done") {
            if (eventData.text) finalResponseText = eventData.text;
            if (eventData.sources) finalSources = eventData.sources;
            if (eventData.persona) finalPersona = eventData.persona;
            if (eventData.toolCalls) finalToolCalls = eventData.toolCalls;
          } else if (eventData.type === "error") {
            callbacks.onError?.(eventData.error || "Akış hatası oluştu.");
          }
        } catch {
          // Ignore partial JSON parse errors in SSE chunks
        }
      }
    }

    flusher.flushNow();
  } finally {
    flusher.cancel();
    reader.releaseLock();
  }

  return {
    finalResponseText,
    finalSources,
    finalPersona,
    finalToolCalls,
  };
}
