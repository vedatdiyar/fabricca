import type { ThesisMatrix } from "@/lib/types";

export interface StreamAdvisorEvents {
  onDelta: (text: string) => void;
  onStatus: (message: string) => void;
}

export interface StreamAdvisorResult {
  modelMessageId: string;
  finalReplyText: string;
  finalUpdatedMatrix?: Partial<ThesisMatrix>;
}

/**
 * Consumes the SSE stream from the Matrix Advisor API endpoint and reports progress events.
 *
 * @param response - The active fetch Response object from /api/onboarding/matrix/advisor.
 * @param events - Callbacks for incremental token deltas and status notifications.
 * @returns Final assembled message ID, reply text, and any updated thesis matrix.
 */
export async function consumeMatrixAdvisorStream(
  response: Response,
  events: StreamAdvisorEvents,
): Promise<StreamAdvisorResult> {
  if (!response.body) {
    throw new Error("Yanıt akışı başlatılamadı.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalReplyText = "";
  let finalUpdatedMatrix: Partial<ThesisMatrix> | undefined;
  let modelMessageId = `model-${Date.now()}`;

  try {
    readLoop: while (true) {
      const { done, value } = await reader.read();
      if (done) break readLoop;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";

      for (const block of lines) {
        const trimmedBlock = block.trim();
        if (!trimmedBlock.startsWith("data:")) continue;

        const jsonStr = trimmedBlock.replace(/^data:\s*/, "");
        if (jsonStr === "[DONE]") {
          reader.cancel().catch(() => {});
          break readLoop;
        }

        try {
          const eventData = JSON.parse(jsonStr);

          if (eventData.type === "delta" && eventData.text) {
            finalReplyText += eventData.text;
            events.onDelta(finalReplyText);
          } else if (eventData.type === "status" && eventData.message) {
            events.onStatus(eventData.message);
          } else if (eventData.type === "tool_call") {
            if (eventData.status === "running") {
              const toolLabel =
                eventData.name === "lookupPrecedentTheses"
                  ? "YÖK Tez Arşivi taranıyor"
                  : eventData.name === "lookupScholarlyLiterature"
                    ? "Uluslararası Literatür (OpenAlex) taranıyor"
                    : "Saha ve Güncel Raporlar (Exa) taranıyor";
              const q = eventData.query ? `: "${eventData.query}"` : "...";
              events.onStatus(`${toolLabel}${q}`);
            } else if (eventData.status === "done") {
              events.onStatus(
                "Literatür bulguları sentezleniyor ve Sokratik analiz hazırlanıyor...",
              );
            }
          } else if (eventData.type === "done") {
            if (eventData.messageId) {
              modelMessageId = eventData.messageId;
            }
            if (eventData.replyText) {
              finalReplyText = eventData.replyText;
            }
            if (eventData.updatedMatrix) {
              finalUpdatedMatrix = eventData.updatedMatrix;
            }
            reader.cancel().catch(() => {});
            break readLoop;
          } else if (eventData.type === "error" && eventData.error) {
            throw new Error(eventData.error);
          }
        } catch (parseErr) {
          if (
            parseErr instanceof Error &&
            parseErr.message !== "Unexpected end of JSON input"
          ) {
            if (parseErr.message.includes("Danışman")) throw parseErr;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    modelMessageId,
    finalReplyText,
    finalUpdatedMatrix,
  };
}
