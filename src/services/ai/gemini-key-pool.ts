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

let nextKeyIndex = 0;

/**
 * Returns the next Gemini key in round-robin order across the enabled keys.
 *
 * Distributes request traffic evenly across all enabled keys so that the
 * combined per-minute budget of every key is used (e.g. 3 keys × 15 RPM).
 *
 * @returns The next API key string in rotation order.
 */
export function getNextGeminiKey(): string {
  const pool = getGeminiKeyPool();
  const key = pool.keys[nextKeyIndex % pool.keys.length];
  nextKeyIndex++;
  return key;
}

/**
 * Resolves the 0-based project/key index for a given API key string.
 *
 * @param apiKey - The Gemini API key string.
 * @returns The 0-based index of the key in the pool, or 0 if not found.
 */
export function getProjectIndex(apiKey?: string): number {
  if (!apiKey) return 0;
  const pool = getGeminiKeyPool();
  const idx = pool.keys.indexOf(apiKey);
  return idx >= 0 ? idx : 0;
}

