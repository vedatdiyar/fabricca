/**
 * Single source of truth for every external-service rate and concurrency limit.
 *
 * Configured limits:
 * - OPENALEX_REGULAR_LIMITS: Saniyede max 100 istek (6.000 RPM)
 * - OPENALEX_SEMANTIC_LIMITS: Saniyede max 1 istek (60 RPM, concurrency 1)
 * - CROSSREF_LIMITS: Saniyede max 10 istek (600 RPM), concurrency 3
 * - SEMANTIC_SCHOLAR_LIMITS: Saniyede max 1 istek (60 RPM, concurrency 1)
 * - COHERE_LIMITS: Dakikada max 10 istek (10 RPM)
 * - CEREBRAS_LIMITS: Dakikada max 5 istek (5 RPM)
 * - CLOUDFLARE_EMBEDDINGS_LIMITS: Dakikada max 3.000 istek (3000 RPM)
 * - GEMINI_MODEL_QUOTAS: Flash Lite modeller 15 RPM, Flash modeller 5 RPM
 */
import { FLASH_LITE_31, FLASH_LITE_35, FLASH_36 } from "@/lib/constants";
import type { RateLimiterOptions } from "@/lib/rate-limiter";

/** OpenAlex regular `/works` queries — saniyede max 100 istek (6.000 req/min). */
export const OPENALEX_REGULAR_LIMITS: RateLimiterOptions = {
  label: "openalex_regular",
  rpm: 6000,
};

/** OpenAlex semantic search — saniyede max 1 istek (60 req/min, concurrency 1). */
export const OPENALEX_SEMANTIC_LIMITS: RateLimiterOptions = {
  label: "openalex_semantic",
  rpm: 60,
  concurrency: 1,
};

/** Crossref — saniyede max 10 istek (600 req/min), concurrency 3. */
export const CROSSREF_LIMITS: RateLimiterOptions = {
  label: "crossref",
  rpm: 600,
  concurrency: 3,
};

/** Semantic Scholar — saniyede max 1 istek (60 req/min, concurrency 1). */
export const SEMANTIC_SCHOLAR_LIMITS: RateLimiterOptions = {
  label: "semantic_scholar",
  rpm: 60,
  concurrency: 1,
};

/** Cohere Rerank — dakikada max 10 istek (10 req/min). */
export const COHERE_LIMITS: RateLimiterOptions = {
  label: "cohere",
  rpm: 10,
};

/** Cerebras — dakikada max 5 istek (5 req/min). */
export const CEREBRAS_LIMITS: RateLimiterOptions = {
  label: "cerebras",
  rpm: 5,
};

/** Cloudflare Workers AI text embeddings — dakikada max 3.000 istek (3000 req/min). */
export const CLOUDFLARE_EMBEDDINGS_LIMITS: RateLimiterOptions = {
  label: "cloudflare_embeddings",
  rpm: 3000,
};

/** Per-model Gemini quota (per key). */
export interface GeminiModelQuota {
  rpm: number;
}

export const GEMINI_MODEL_QUOTAS: Record<string, GeminiModelQuota> = {
  [FLASH_LITE_31]: { rpm: 15 },
  [FLASH_LITE_35]: { rpm: 15 },
  [FLASH_36]: { rpm: 5 },
};

/** Primary model -> fallback. */
export const GEMINI_FALLBACK_CHAINS: Record<string, string | null> = {
  [FLASH_LITE_35]: FLASH_LITE_31,
  [FLASH_LITE_31]: null,
  [FLASH_36]: null,
};

/**
 * Operations permitted to fall back to a weaker Gemini model.
 */
export const GEMINI_FALLBACK_OPERATIONS = ["pdf_read", "sanitize"] as const;

export type GeminiFallbackOperation =
  (typeof GEMINI_FALLBACK_OPERATIONS)[number];

export const GEMINI_KEY_UTILIZATION = 1.0;
