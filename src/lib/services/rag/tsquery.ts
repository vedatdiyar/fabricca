/**
 * Pure query → tsquery body builder for the lexical (PostgreSQL FTS) branch.
 *
 * Deliberately DB-free so it can be unit-tested without a database connection.
 * Uses the language-neutral `simple` configuration contract: tokens are plain
 * Unicode letters/digits AND-joined with `&`, so the resulting string is always
 * safe to feed into `to_tsquery('simple', ...)`.
 */

/**
 * Normalizes a single query token for consistent `simple`-config matching.
 *
 * The Turkish dotted capital `İ` (U+0130) lowercases to `i` + combining dot in
 * JS, which would split the token. It is mapped to plain ASCII `i` first
 * (matching PostgreSQL glibc `lower()` behavior). All other Turkish letters
 * (ç, ğ, ı, ö, ş, ü) are left untouched — accents are intentionally preserved
 * because the lexical branch targets exact token signals.
 *
 * @param value - Raw query text.
 * @returns Locale-agnostic lowercase token source.
 */
export function normalizeForLexical(value: string): string {
  return value.replace(/\u0130/g, "i").toLowerCase();
}

/**
 * Builds a safe `to_tsquery` input string from a raw user query.
 *
 * Extracts only Unicode letters/digits (Turkish characters included), normalizes
 * them, deduplicates and AND-joins them. Any punctuation — quotes, parentheses,
 * slashes, colons, apostrophes, academic symbols — is stripped, so the generated
 * string can never corrupt the FTS query. Academic terms stay intact as exact
 * token signals (`CRISPR-Cas9` → `crispr & cas9`, `ISO 27001` → `iso & 27001`).
 *
 * @param query - Raw user query.
 * @param maxTokens - Maximum number of AND-ed tokens (guards against overly narrow queries).
 * @returns Safe tsquery body, or `null` when the query has no usable tokens.
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
