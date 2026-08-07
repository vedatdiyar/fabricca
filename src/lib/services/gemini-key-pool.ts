/**
 * Canonical Gemini API key pool.
 *
 * Single source of truth for the ordered set of Gemini API keys used across the
 * project (main `generateStructuredContent`, PDF parser, per-thesis evaluation).
 * The environment variables are the external contract (`GEMINI_API_KEY_1..3`);
 * every consumer reads ordering and rotation through this module rather than
 * touching `process.env.GEMINI_API_KEY_*` directly.
 */
const GEMINI_ENV_KEYS = [
  "GEMINI_API_KEY_1",
  "GEMINI_API_KEY_2",
  "GEMINI_API_KEY_3",
] as const;

/** Read-only ordered key collection exposed by the pool. */
export interface GeminiKeyPool {
  /** The enabled keys in assignment order [KEY_1, KEY_2, KEY_3]; empty values removed. */
  readonly keys: readonly string[];
}

/**
 * Resolves the ordered, non-empty Gemini API keys from the environment.
 *
 * @returns Array of enabled key strings in `GEMINI_API_KEY_1..3` order.
 */
function resolveGeminiKeys(): string[] {
  const keys = GEMINI_ENV_KEYS.map((name) => process.env[name])
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);

  if (keys.length === 0) {
    throw new Error("GEMINI_API_KEY_1 environment variable is not defined.");
  }
  return [...new Set(keys)];
}

let keyPool: GeminiKeyPool | null = null;

/**
 * Returns the lazily-initialized shared Gemini key pool.
 *
 * @returns The canonical key pool instance.
 */
export function getGeminiKeyPool(): GeminiKeyPool {
  if (!keyPool) {
    keyPool = { keys: resolveGeminiKeys() };
  }
  return keyPool;
}

/**
 * Computes the next circular key position in the pool.
 *
 * @param position - The current 0-based key position.
 * @param total - The number of keys in the pool.
 * @returns The next 0-based key position (wrapping to 0 past the end).
 */
export function nextKeyPosition(position: number, total: number): number {
  if (total <= 0) return 0;
  return (position + 1) % total;
}
