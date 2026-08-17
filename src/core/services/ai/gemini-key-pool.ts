/**
 * Canonical Gemini API key pool manager.
 *
 * Single source of truth for the active set of Gemini API keys.
 * Exposes the configured keys for balanced distribution, dynamic round-robin,
 * and automatic failover across accounts.
 */

/** Read-only ordered key collection exposed by the pool. */
export interface GeminiKeyPool {
  /** The enabled keys configured in the environment. */
  readonly keys: readonly string[];
}

/**
 * Resolves the ordered, non-empty Gemini API keys from the environment.
 *
 * @returns Array of enabled key strings in priority order.
 */
function resolveGeminiKeys(): string[] {
  const primary = (
    process.env.GEMINI_API_KEY_1 ??
    process.env.GEMINI_API_KEY ??
    ""
  ).trim();

  const secondary = (process.env.GEMINI_API_KEY_2 ?? "").trim();
  const tertiary = (process.env.GEMINI_API_KEY_3 ?? "").trim();

  const rawKeys = [primary, secondary, tertiary].filter(Boolean);

  if (rawKeys.length === 0) {
    throw new Error(
      "Neither GEMINI_API_KEY_1 nor GEMINI_API_KEY environment variable is defined.",
    );
  }

  return [...new Set(rawKeys)];
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
 * Resolves the 0-based project/key index for a given API key string.
 *
 * @param apiKey - Optional Gemini API key string.
 * @returns The 0-based index of the key in the pool, or 0 if not found.
 */
export function getProjectIndex(apiKey?: string): number {
  if (!apiKey) return 0;
  const pool = getGeminiKeyPool();
  const idx = pool.keys.indexOf(apiKey);
  return idx >= 0 ? idx : 0;
}
