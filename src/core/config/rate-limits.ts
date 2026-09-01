/**
 * Single source of truth for every external-service rate and concurrency limit.
 *
 * Configured limits:
 * - OPENALEX_REGULAR_LIMITS: Saniyede max 100 istek (6.000 RPM)
 * - OPENALEX_SEMANTIC_LIMITS: Saniyede max 1 istek (60 RPM, concurrency 1)
 * - CROSSREF_LIMITS: Saniyede max 10 istek (600 RPM), concurrency 3
 * - SEMANTIC_SCHOLAR_LIMITS: Saniyede max 1 istek (60 RPM, concurrency 1)
 * - COHERE_LIMITS: Dakikada max 10 istek (10 RPM)
 * - CLOUDFLARE_EMBEDDINGS_LIMITS: Dakikada max 3.000 istek (3000 RPM)
 * - GEMINI_MODEL_QUOTAS: Flash Lite 15 RPM/500 RPD, Flash 5 RPM/20 RPD (free tier, per key; 3 key toplam 45/1500 ve 15/60)
 */
import { FLASH_LITE_35, FLASH_36 } from "@/lib/constants";
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

/** Cloudflare Workers AI text embeddings — dakikada max 3.000 istek (3000 req/min). */
export const CLOUDFLARE_EMBEDDINGS_LIMITS: RateLimiterOptions = {
  label: "cloudflare_embeddings",
  rpm: 3000,
};

/** Per-model Gemini quota (per key, free tier). */
export interface GeminiModelQuota {
  rpm: number;
  rpd: number;
}

export const GEMINI_MODEL_QUOTAS: Record<string, GeminiModelQuota> = {
  [FLASH_LITE_35]: { rpm: 15, rpd: 500 },
  [FLASH_36]: { rpm: 5, rpd: 20 },
};

/** Primary model -> fallback. */
export const GEMINI_FALLBACK_CHAINS: Record<string, string | null> = {
  [FLASH_36]: FLASH_LITE_35,
  [FLASH_LITE_35]: null,
};

export const GEMINI_FALLBACK_OPERATIONS = [
  "pdf_read",
  "sanitize",
  "literature_sanitization",
  "literature_targeted_sanitization",
  "box_structure_generation",
  "semantic_queries",
  "semantic_query_generation",
  "batch_jury",
  "literature_single_box_jury",
  "proposal_synthesis",
  "matrix_synthesis",
  "initial_matrix_synthesis",
  "outline_generation",
  "thesis_evaluation",
  "positioning_jury_synthesis",
  "positioning_query_generation",
  "card_outline_auto_mapping",
] as const;

export type GeminiFallbackOperation =
  (typeof GEMINI_FALLBACK_OPERATIONS)[number];

export const GEMINI_KEY_UTILIZATION = 1.0;
