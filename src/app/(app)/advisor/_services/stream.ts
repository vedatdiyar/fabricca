import { createFlowId, Logger } from "@/lib/logger";
import { sanitizeModelStreamText } from "@/lib/text-sanitizer";

/**
 * Typed SSE event emitter used across the advisor streaming flow.
 *
 * `send` emits a structured JSON event, `delta` emits sanitized text deltas,
 * and `done` emits the standard SSE `[DONE]` sentinel.
 */
export interface AdvisorStreamWriter {
  send(type: string, payload?: Record<string, unknown>): void;
  delta(text: string): void;
  done(): void;
}

/** Context handed to a stream body function created by {@link createSseStream}. */
export interface SseStreamContext {
  writer: AdvisorStreamWriter;
}

/**
 * Serializes a payload into a single SSE `data:` frame.
 *
 * @param payload - The structured event payload to encode.
 * @returns The encoded SSE data frame.
 */
function encodeSseEvent(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/**
 * Builds a stream writer bound to a ReadableStream controller.
 *
 * @param controller - The stream controller to enqueue into.
 * @param encoder - The UTF-8 text encoder used for encoding frames.
 * @returns The typed advisor stream writer.
 */
function createStreamWriter(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): AdvisorStreamWriter {
  return {
    send(type, payload = {}) {
      controller.enqueue(encoder.encode(encodeSseEvent({ type, ...payload })));
    },
    delta(text) {
      controller.enqueue(
        encoder.encode(
          encodeSseEvent({
            type: "delta",
            text: sanitizeModelStreamText(text),
          }),
        ),
      );
    },
    done() {
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
    },
  };
}

/**
 * Wraps an async body function into a ReadableStream with uniform SSE error
 * handling: unexpected errors emit an `error` event and the stream is closed.
 *
 * @param run - The stream body function receiving the typed writer.
 * @returns A ReadableStream streaming advisor SSE events.
 */
export function createSseStream(
  run: (ctx: SseStreamContext) => Promise<void> | void,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const writer = createStreamWriter(controller, encoder);
        await run({ writer });
      } catch (err) {
        const errorDetail = err instanceof Error ? err.message : String(err);
        new Logger(createFlowId()).error("Advisor API error:", {
          service: "advisor",
          error: err,
          data: { errorDetail },
        });
        controller.enqueue(
          encoder.encode(
            encodeSseEvent({
              type: "error",
              error: "Yanıt üretilirken hata oluştu.",
            }),
          ),
        );
      } finally {
        try {
          controller.close();
        } catch {
          // Stream was already closed by the run phase.
        }
      }
    },
  });
}
