import { GoogleGenAI } from "@google/genai";
import type { KeyWorker, PauseGate } from "./types";

/**
 * Creates a shared pause gate for coordinating 429 backoff across concurrent workers.
 *
 * @returns Pause gate instance.
 */
export function createPauseGate(): PauseGate {
  let pauseUntil = 0;
  let gatePromise: Promise<void> | null = null;

  return {
    wait(): Promise<void> {
      if (gatePromise) return gatePromise;
      const remaining = pauseUntil - Date.now();
      if (remaining > 0) {
        gatePromise = new Promise((resolve) =>
          setTimeout(() => {
            gatePromise = null;
            resolve();
          }, remaining),
        );
        return gatePromise;
      }
      return Promise.resolve();
    },

    pause(ms: number): void {
      const until = Date.now() + ms;
      if (until > pauseUntil) {
        pauseUntil = until;
        gatePromise = null;
      }
    },

    isReady(): boolean {
      return Date.now() >= pauseUntil;
    },

    getPauseUntil(): number {
      return pauseUntil;
    },
  };
}

/**
 * Parses Gemini's retry delay from a 429 error response body.
 *
 * @param error - Caught error from the Gemini SDK.
 * @returns Delay in milliseconds, or null when not present.
 */
export function parseRetryDelayMs(error: unknown): number | null {
  if (!(error instanceof Error)) return null;

  try {
    const bodyMatch = error.message.match(/\{[\s\S]*\}/);
    if (!bodyMatch) return null;
    const body = JSON.parse(bodyMatch[0]) as {
      error?: {
        details?: Array<Record<string, unknown>>;
      };
    };
    const details = body?.error?.details ?? [];
    for (const detail of details) {
      if (
        detail["@type"] === "type.googleapis.com/google.rpc.RetryInfo" &&
        typeof detail["retryDelay"] === "string"
      ) {
        const match = (detail["retryDelay"] as string).match(/^(\d+)s$/);
        if (match) return parseInt(match[1], 10) * 1000;
      }
    }
  } catch {
    // Body was not JSON
  }

  return null;
}

/**
 * Resolves all configured Gemini API keys for PDF parsing from environment variables.
 *
 * @returns Array of unique non-empty API key strings.
 */
export function getPdfParserApiKeys(): string[] {
  const keys: string[] = [];
  const envVarNames = [
    "PDF_PARSER_GEMINI_API_KEY",
    "PDF_PARSER_GEMINI_API_KEY_1",
    "PDF_PARSER_GEMINI_API_KEY_2",
    "PDF_PARSER_GEMINI_API_KEY_3",
    "PDF_PARSER_GEMINI_API_KEY_4",
    "PDF_PARSER_GEMINI_API_KEY_5",
  ];

  for (const name of envVarNames) {
    const val = process.env[name];
    if (val) {
      const parts = val
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      keys.push(...parts);
    }
  }

  const uniqueKeys = Array.from(new Set(keys));
  if (uniqueKeys.length === 0) {
    const fallbackKey = process.env.GEMINI_API_KEY;
    if (fallbackKey) return [fallbackKey];
    throw new Error(
      "PDF_PARSER_GEMINI_API_KEY environment variable is not defined.",
    );
  }
  return uniqueKeys;
}

let keyWorkerPool: KeyWorker[] | null = null;

/**
 * Returns the lazily-initialized worker pool containing client and gate for each API key.
 *
 * @returns Array of key worker instances.
 */
export function getPdfParserKeyPool(): KeyWorker[] {
  if (!keyWorkerPool) {
    const keys = getPdfParserApiKeys();
    keyWorkerPool = keys.map((apiKey, index) => ({
      keyIndex: index + 1,
      apiKey,
      client: new GoogleGenAI({ apiKey }),
      gate: createPauseGate(),
    }));
  }
  return keyWorkerPool;
}

/**
 * Selects the optimal key worker for a batch attempt.
 *
 * @param pool - Array of initialized key workers.
 * @param preferredKeyIndex - Assigned 0-based key index.
 * @param attempt - 1-based attempt number.
 * @returns Selected key worker instance.
 */
export function selectWorker(
  pool: KeyWorker[],
  preferredKeyIndex: number,
  attempt: number,
): KeyWorker {
  if (pool.length === 0) {
    throw new Error("No API key workers available.");
  }

  const targetIndex = (preferredKeyIndex + attempt - 1) % pool.length;
  const targetWorker = pool[targetIndex];

  if (targetWorker.gate.isReady()) {
    return targetWorker;
  }

  const readyWorkers = pool.filter((w) => w.gate.isReady());
  if (readyWorkers.length > 0) {
    return readyWorkers[0];
  }

  return pool.reduce((earliest, curr) =>
    curr.gate.getPauseUntil() < earliest.gate.getPauseUntil() ? curr : earliest,
  );
}
