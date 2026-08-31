import "server-only";
import { GoogleGenAI } from "@google/genai";
import { getGeminiKeyPool } from "../gemini-key-pool";

let aiInstance: GoogleGenAI | null = null;
const aiInstancesByKey = new Map<string, GoogleGenAI>();

/**
 * Disables the SDK's built-in HTTP retry so `withRetry` remains the single retry
 * owner. Empirically verified on @google/genai 2.16.0: the classic generateContent
 * / generateContentStream path retries ONLY when `httpOptions.retryOptions` is
 * present, and `attempts: 1` means the original request runs exactly once.
 */
export const SDK_SINGLE_ATTEMPT_HTTP_OPTIONS = {
  httpOptions: { retryOptions: { attempts: 1 } },
} as const;

/**
 * Returns a lazily-initialized GoogleGenAI client, defaulting to the GEMINI_API_KEY_1
 * environment variable or a per-key cached client when an explicit key is provided.
 *
 * @param apiKey - Optional Gemini API key override for multi-key load distribution.
 * @returns The shared GoogleGenAI instance.
 */
export function getAi(apiKey?: string): GoogleGenAI {
  if (!apiKey) {
    if (!aiInstance) {
      const envKey = getGeminiKeyPool().keys[0];
      aiInstance = new GoogleGenAI({
        apiKey: envKey,
        ...SDK_SINGLE_ATTEMPT_HTTP_OPTIONS,
      });
    }
    return aiInstance;
  }

  const cached = aiInstancesByKey.get(apiKey);
  if (cached) return cached;
  const client = new GoogleGenAI({
    apiKey,
    ...SDK_SINGLE_ATTEMPT_HTTP_OPTIONS,
  });
  aiInstancesByKey.set(apiKey, client);
  return client;
}
