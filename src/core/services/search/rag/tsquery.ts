import { normalizeTurkishChars } from "@/lib/academic/normalize";

/**
 * Normalizes a query token for `simple`-config matching; uses the central
 * Turkish map (İ/ı/Ğ/ğ/Ş/ş/Ç/ç/Ö/ö/Ü/ü) then lowercases to match PostgreSQL `lower()`.
 *
 * @param value - The query token to normalize.
 * @returns The lowercased, ASCII-normalized token.
 */
export function normalizeForLexical(value: string): string {
  return normalizeTurkishChars(value).toLowerCase();
}

/** English and Turkish stop-words stripped from queries so the OR-prefix tsquery stays focused on content terms. */
const STOP_WORDS = new Set([
  // English
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "me",
  "my",
  "no",
  "nor",
  "not",
  "of",
  "on",
  "or",
  "our",
  "out",
  "over",
  "s",
  "so",
  "such",
  "t",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "too",
  "up",
  "us",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "will",
  "with",
  "would",
  "you",
  "your",
  // Turkish
  "acaba",
  "ama",
  "ancak",
  "asla",
  "az",
  "bazı",
  "belki",
  "ben",
  "bence",
  "bile",
  "bir",
  "birçok",
  "birkaç",
  "bu",
  "buna",
  "bunlar",
  "bunları",
  "bunun",
  "çok",
  "da",
  "daha",
  "de",
  "değil",
  "diye",
  "en",
  "gibi",
  "hem",
  "hepsi",
  "her",
  "hiç",
  "hangi",
  "için",
  "ile",
  "ise",
  "kadar",
  "ki",
  "ma",
  "me",
  "mi",
  "mı",
  "mu",
  "mü",
  "nasıl",
  "ne",
  "neden",
  "o",
  "onu",
  "onlar",
  "sana",
  "sen",
  "seni",
  "sizin",
  "şey",
  "şu",
  "ve",
  "veya",
  "ya",
  "yani",
]);

/**
 * Builds a relaxed OR-based prefix tsquery: drops stop-words and joins remaining content tokens with `|` and `:*` prefix expansion.
 *
 * @param query - The raw search query text.
 * @param maxTokens - The maximum number of content tokens to include.
 * @returns The OR-joined prefix tsquery string, or null when no content tokens remain.
 */
export function buildLexicalTsQuery(
  query: string,
  maxTokens = 8,
): string | null {
  const normalized = normalizeForLexical(query);
  const matches = normalized.match(/[\p{L}\p{N}]+/gu);
  if (!matches || matches.length === 0) return null;
  const tokens = [...new Set(matches)]
    .filter((token) => !STOP_WORDS.has(token))
    .slice(0, maxTokens);
  if (tokens.length === 0) return null;
  return tokens.map((token) => `${token}:*`).join(" | ");
}
