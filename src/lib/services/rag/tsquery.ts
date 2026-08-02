/**
 * Normalizes a query token for `simple`-config matching; maps Turkish dotted İ (U+0130) to ASCII `i` to match PostgreSQL lower().
 *
 * @param value - The query token to normalize.
 * @returns The lowercased, ASCII-normalized token.
 */
export function normalizeForLexical(value: string): string {
  return value.replace(/\u0130/g, "i").toLowerCase();
}

/**
 * Builds a safe to_tsquery input: extracts Unicode letters/digits, deduplicates, and AND-joins up to maxTokens.
 *
 * @param query - The raw search query text.
 * @param maxTokens - The maximum number of tokens to AND-join.
 * @returns The AND-joined to_tsquery string, or null when no tokens are found.
 */
export function buildLexicalTsQuery(
  query: string,
  maxTokens = 8,
): string | null {
  const normalized = normalizeForLexical(query);
  const matches = normalized.match(/[\p{L}\p{N}]+/gu);
  if (!matches || matches.length === 0) return null;
  const tokens = [...new Set(matches)].slice(0, maxTokens);
  return tokens.join(" & ");
}
