"use client";

import { useCallback } from "react";

/** A single structured SSE event emitted by the advisor stream. */
export type AdvisorStreamEvent = Record<string, unknown> & { type: string };

/**
 * Parses an advisor SSE response body into a sequence of structured events.
 *
 * Handles chunk buffering, line splitting, the `data: ` prefix, the `[DONE]`
 * sentinel, and skips any malformed frames without aborting the stream.
 *
 * @param response - The SSE fetch response to stream.
 * @yields Parsed advisor stream events.
 */
export async function* streamAdvisorEvents(
  response: Response,
): AsyncGenerator<AdvisorStreamEvent> {
  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);
          if (event && typeof event.type === "string") {
            yield event as AdvisorStreamEvent;
          }
        } catch {
          // Skip malformed SSE lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Provides a stable SSE stream reader that dispatches parsed events to a callback.
 *
 * @returns A stable `readStream` callback invoking the handler for each parsed event.
 */
export function useAdvisorStream() {
  const readStream = useCallback(
    async (
      response: Response,
      onEvent: (event: AdvisorStreamEvent) => void | Promise<void>,
    ): Promise<void> => {
      for await (const event of streamAdvisorEvents(response)) {
        await onEvent(event);
      }
    },
    [],
  );

  return { readStream };
}
