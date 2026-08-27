import { createStreamFlusher } from "./stream-flusher";

export interface StreamDefenseOptions {
  sessionId: number;
  userMessage?: string;
  onDelta: (accumulatedText: string) => void;
}

/**
 * Executes a defense query against the Advisor API and streams response tokens in real-time.
 *
 * @param options - Defense session id, optional prompt, and text delta callback.
 * @returns Fully accumulated advisor defense statement.
 */
export async function streamOfficeDefenseReply({
  sessionId,
  userMessage,
  onDelta,
}: StreamDefenseOptions): Promise<string> {
  const response = await fetch("/api/advisor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "DEFENSE",
      sessionId,
      userMessage,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error("Danışman yanıtı alınamadı.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const flusher = createStreamFlusher();
  let accumulatedText = "";
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const trimmedFrame = frame.trim();
        if (!trimmedFrame.startsWith("data:")) continue;
        const dataStr = trimmedFrame.replace(/^data:\s*/, "");
        if (!dataStr || dataStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(dataStr);
          if (
            (parsed.type === "delta" || parsed.type === "chunk") &&
            parsed.text
          ) {
            accumulatedText += parsed.text;
            flusher.schedule(() => onDelta(accumulatedText));
          }
        } catch {
          // Ignore non-json frames
        }
      }
    }

    // Flush any final unterminated frame left in the remainder buffer.
    const tail = buffer.trim();
    if (tail.startsWith("data:")) {
      const dataStr = tail.replace(/^data:\s*/, "");
      if (dataStr && dataStr !== "[DONE]") {
        try {
          const parsed = JSON.parse(dataStr);
          if (
            (parsed.type === "delta" || parsed.type === "chunk") &&
            parsed.text
          ) {
            accumulatedText += parsed.text;
          }
        } catch {
          // Ignore non-json tail frame
        }
      }
    }

    flusher.flushNow();
  } finally {
    flusher.cancel();
    reader.releaseLock();
  }

  return accumulatedText;
}
