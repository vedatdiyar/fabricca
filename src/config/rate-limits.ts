/**
 * Single source of truth for every external-service rate limit.
 *
 * Provider ceilings were taken from official documentation (2026-08):
 * - OpenAlex: regular `/works` queries 100 req/s (billing-budget bound long term);
 *   semantic search is HARD-limited to 1 req/s.
 * - Crossref: polite pool rate 10 / concurrency 2 (public pool is 5/1; send `mailto`).
 *   No Crossref HTTP call exists in the codebase today; these values await use.
 * - Semantic Scholar: keyed access 1 req/s.
 * - Cohere Rerank (trial key): 10 req/min.
 * - Cerebras `gemma-4-31b` (free trial): 5 RPM.
 * - Cloudflare Workers AI text embeddings: 3000 req/min.
 * - Gemini (per key, per model): Flash available 15 RPM / 500 RPD;
 *   3.6 Flash 5 RPM / 20 RPD. Daily quotas reset at Pacific midnight.
 *
 * Mistral OCR publishes no rate numbers, so it keeps its own retry-on-429 logic
 * and is intentionally NOT listed here.
 */
import { FLASH_LITE_31, FLASH_LITE_35, FLASH_36 } from "@/lib/constants";
import type { RateLimiterOptions } from "@/lib/rate-limiter";

/** OpenAlex regular `/works` queries — 10 req/s pace, provider ceiling 100 req/s. */
export const OPENALEX_REGULAR_LIMITS: RateLimiterOptions = {
  label: "openalex_regular",
  rpm: 600,
  concurrency: 2,
};

/** OpenAlex semantic search — provider HARD limit is 1 req/s. Do not raise. */
export const OPENALEX_SEMANTIC_LIMITS: RateLimiterOptions = {
  label: "openalex_semantic",
  rpm: 60,
  concurrency: 1,
};

/** Crossref polite pool — rate 10 / concurrency 2 (no live call yet; `mailto` required when used). */
export const CROSSREF_LIMITS: RateLimiterOptions = {
  label: "crossref",
  rpm: 10,
  concurrency: 2,
};

/** Semantic Scholar — keyed access is 1 req/s. */
export const SEMANTIC_SCHOLAR_LIMITS: RateLimiterOptions = {
  label: "semantic_scholar",
  rpm: 60,
  concurrency: 1,
};

/** Cohere Rerank — trial key allows 10 req/min. */
export const COHERE_LIMITS: RateLimiterOptions = {
  label: "cohere",
  rpm: 10,
  concurrency: 3,
};

/** Cerebras `gemma-4-31b` — free trial tier allows 5 RPM. */
export const CEREBRAS_LIMITS: RateLimiterOptions = {
  label: "cerebras",
  rpm: 5,
  concurrency: 1,
};

/** Cloudflare Workers AI text embeddings — 3000 req/min task ceiling. */
export const CLOUDFLARE_EMBEDDINGS_LIMITS: RateLimiterOptions = {
  label: "cloudflare_embeddings",
  rpm: 3000,
  concurrency: 5,
};

/** Per-model Gemini quota (per key). Counters reset at midnight Pacific. */
export interface GeminiModelQuota {
  rpm: number;
  rpd: number;
}

export const GEMINI_MODEL_QUOTAS: Record<string, GeminiModelQuota> = {
  [FLASH_LITE_31]: { rpm: 15, rpd: 500 },
  [FLASH_LITE_35]: { rpm: 15, rpd: 500 },
  [FLASH_36]: { rpm: 5, rpd: 20 },
};

/** Primary model -> fallback, used ONLY when every key is daily-exhausted. */
export const GEMINI_FALLBACK_CHAINS: Record<string, string | null> = {
  [FLASH_LITE_35]: FLASH_LITE_31,
  [FLASH_LITE_31]: null,
  [FLASH_36]: null,
};

/**
 * Operations permitted to fall back to a weaker Gemini model when the daily
 * quota of every key is exhausted (user decision: loss-less for these only).
 * Every other operation hard-stops with a "quota exhausted" outcome instead.
 */
export const GEMINI_FALLBACK_OPERATIONS = ["pdf_read", "sanitize"] as const;

export type GeminiFallbackOperation =
  (typeof GEMINI_FALLBACK_OPERATIONS)[number];

/**
 * Planned utilization ceiling for Gemini keys. Scheduler reserves ~15% slack so
 * a single failed key can be rebalanced (or retried) without overflowing a
 * neighbor and triggering a 429 cascade.
 */
export const GEMINI_KEY_UTILIZATION = 0.85;
