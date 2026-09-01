/**
 * Balanced Least-Used & Round-Robin Gemini key dispatcher with Multi-Key Sharded Batching.
 *
 * Architecture:
 * 1. VIP / Interactive Lane: Live chat and streaming calls bypass batch queues and immediately
 *    dispatch on the least-loaded, non-cooling API key.
 * 2. Balanced Batch Sharding (10-10-10): Batch workloads (N items) are evenly partitioned across
 *    all healthy API keys (K=3) and executed concurrently in parallel shards.
 * 3. Autonomous Cooldown & Failover: Automatic 15s-60s RPM cooldown, Pacific midnight RPD reset,
 *    and cross-key / cross-model fallback chain support.
 */
import type { Logger } from "@/lib/logger";
import {
  GEMINI_FALLBACK_CHAINS,
  GEMINI_FALLBACK_OPERATIONS,
} from "@/core/config/rate-limits";
import { DailyQuotaExceededError } from "@/lib/rate-limiter";
import { getGeminiKeyPool } from "./gemini-key-pool";
import {
  isRateLimitError,
  isRpdError,
  isServerOverloadError,
  isTimeoutError,
  extractQuotaDetails,
  extractRetryDelayMs,
} from "./llm-errors";
import {
  markKeyRpdExhausted,
  markKeyRpmCoolingDown,
  recordKeyUsage,
  incrementInFlight,
  decrementInFlight,
  getKeyUsageStats,
  resetGeminiScheduler,
} from "./scheduler-state";
import { getBalancedKeyCandidates } from "./candidate-selector";

export { getKeyUsageStats, resetGeminiScheduler };

/** Client timeout in milliseconds for the primary model when a fallback model exists (45s). */
export const GEMINI_PRIMARY_MODEL_TIMEOUT_MS = 45_000;

/**
 * Wraps a promise with a timeout deadline in milliseconds.
 *
 * @param promise - The promise to await.
 * @param timeoutMs - Maximum allowed duration in milliseconds.
 * @param timeoutErrorMsg - Error message to throw if timeout expires.
 * @returns The resolved value of the promise.
 */
function withPromiseTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutErrorMsg: string,
): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(timeoutErrorMsg);
      err.name = "TimeoutError";
      reject(err);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** The `(model, apiKey)` pair a Gemini call is dispatched on. */
export interface GeminiTarget {
  /** The model actually called (may be the fallback model). */
  model: string;
  /** The API key assigned to this call. */
  apiKey: string;
}

export interface GeminiDispatchParams<T> {
  /** The preferred model for the operation. */
  model: string;
  /**
   * Pipeline operation key. When present and listed in
   * `GEMINI_FALLBACK_OPERATIONS`, a model fallback may be attempted.
   */
  operation?: string;
  /**
   * Dispatch lane.
   * - "interactive" (VIP Lane): Prioritizes the lowest in-flight active key for live chat.
   * - "batch" (Default): Standard load-balanced execution.
   */
  lane?: "interactive" | "batch";
  /**
   * Optional target 0-based key pool index for sharded batch operations.
   */
  targetKeyIndex?: number;
  /** Optional logger to output key rotation and scheduler events. */
  logger?: Logger;
  /**
   * Runs the actual LLM call under the resolved target.
   */
  task: (target: GeminiTarget) => Promise<T>;
}

/**
 * Dispatches a single Gemini call across available API keys using balanced least-used round-robin distribution.
 *
 * @typeParam T - The structured output type produced by the task.
 * @param params - The dispatch parameters (preferred model, operation, task).
 * @returns The task result.
 */
export async function dispatchGeminiCall<T>(
  params: GeminiDispatchParams<T>,
): Promise<T> {
  const pool = getGeminiKeyPool().keys;
  if (pool.length === 0) {
    throw new DailyQuotaExceededError(`gemini_${params.model}`);
  }

  const allowFallback =
    params.operation !== undefined
      ? GEMINI_FALLBACK_OPERATIONS.some((op) => op === params.operation) ||
        Boolean(GEMINI_FALLBACK_CHAINS[params.model])
      : Boolean(GEMINI_FALLBACK_CHAINS[params.model]);
  const fallback = allowFallback
    ? (GEMINI_FALLBACK_CHAINS[params.model] ?? null)
    : null;

  const models =
    fallback && fallback !== params.model
      ? [params.model, fallback]
      : [params.model];

  for (const model of models) {
    const keyIndicesToTry = getBalancedKeyCandidates(model, pool, {
      lane: params.lane,
      targetKeyIndex: params.targetKeyIndex,
    });
    if (keyIndicesToTry.length === 0) {
      continue;
    }

    for (let i = 0; i < keyIndicesToTry.length; i++) {
      const apiKey = pool[keyIndicesToTry[i]];
      incrementInFlight(apiKey);
      try {
        const isPrimaryWithFallback = model !== models[models.length - 1];
        const taskPromise = params.task({ model, apiKey });
        const result = isPrimaryWithFallback
          ? await withPromiseTimeout(
              taskPromise,
              GEMINI_PRIMARY_MODEL_TIMEOUT_MS,
              `Model ${model} request exceeded client timeout (${GEMINI_PRIMARY_MODEL_TIMEOUT_MS / 1000}s)`,
            )
          : await taskPromise;

        // Increment usage count for balanced tracking
        recordKeyUsage(apiKey);
        return result;
      } catch (error) {
        const currentKeyIdx = keyIndicesToTry[i];
        const quotaDetails = extractQuotaDetails(error);
        const retryDelayMs = extractRetryDelayMs(error);
        const quotaKind: "rpd_daily" | "rpm_per_minute" | "unknown" =
          isRpdError(error)
            ? "rpd_daily"
            : isRateLimitError(error)
              ? "rpm_per_minute"
              : "unknown";

        if (quotaKind === "rpd_daily") {
          markKeyRpdExhausted(model, apiKey);
        } else if (quotaKind === "rpm_per_minute") {
          markKeyRpmCoolingDown(model, apiKey, retryDelayMs ?? undefined);
        }

        const isOverload = isServerOverloadError(error);
        const isTimeout = isTimeoutError(error);

        // 503 / High demand overload or 45s Timeout is a model-level capacity constraint affecting all keys.
        // If a fallback model is configured, immediately failover to the next model without
        // spinning through all other keys on the overloaded model.
        if ((isOverload || isTimeout) && model !== models[models.length - 1]) {
          const nextModel = models[models.indexOf(model) + 1];
          params.logger?.info("gemini_model_fallback_retry", {
            service: "gemini",
            status: "RETRY",
            data: {
              summary: isTimeout
                ? `(model ${model} timed out after ${GEMINI_PRIMARY_MODEL_TIMEOUT_MS / 1000}s, falling back to ${nextModel})`
                : `(model ${model} overloaded [503/high-demand], falling back to ${nextModel})`,
              fromModel: model,
              toModel: nextModel,
              reason: isTimeout ? "client_timeout" : "server_overload",
            },
          });
          break;
        }

        if (i < keyIndicesToTry.length - 1) {
          const nextKeyIdx = keyIndicesToTry[i + 1];
          const quotaLabel =
            quotaKind === "rpd_daily"
              ? "GUNLUK kota (RPD) — Pacific midnight reset"
              : quotaKind === "rpm_per_minute"
                ? `DAKIKALIK limit (RPM) — retryDelay ${retryDelayMs ? `${Math.round(retryDelayMs / 1000)}s` : "60s (varsayilan)"}`
                : "bilinmeyen 429";
          params.logger?.info("gemini_key_rotate_retry", {
            service: "gemini",
            status: "RETRY",
            data: {
              summary: `(key ${currentKeyIdx + 1} failed [${quotaKind}] → ${quotaLabel}, rotating to key ${nextKeyIdx + 1}/${pool.length})`,
              fromKey: currentKeyIdx + 1,
              toKey: nextKeyIdx + 1,
              totalKeys: pool.length,
              model,
              quotaKind,
              quotaLabel,
              quotaMetric: quotaDetails?.quotaMetric,
              quotaId: quotaDetails?.quotaId,
              retryDelayMs: retryDelayMs ?? undefined,
              errorMessage:
                error instanceof Error
                  ? error.message.slice(0, 300)
                  : String(error).slice(0, 300),
            },
          });
          continue;
        }

        // If this is the last key attempt on the current model, but a fallback model is available
        if (
          i === keyIndicesToTry.length - 1 &&
          model !== models[models.length - 1]
        ) {
          const nextModel = models[models.indexOf(model) + 1];
          params.logger?.info("gemini_model_fallback_retry", {
            service: "gemini",
            status: "RETRY",
            data: {
              summary: `(all keys failed on ${model}, falling back to ${nextModel})`,
              fromModel: model,
              toModel: nextModel,
            },
          });
        }

        // If this is the last key attempt on the last available model, throw
        if (
          i === keyIndicesToTry.length - 1 &&
          model === models[models.length - 1]
        ) {
          throw error;
        }
      } finally {
        decrementInFlight(apiKey);
      }
    }
  }

  throw new DailyQuotaExceededError(`gemini_${params.model}`);
}

/** Options for dispatching parallel batch workloads evenly across keys. */
export interface GeminiBatchOptions<TItem, TResult> {
  /** Array of items to process. */
  items: readonly TItem[];
  /** Target Gemini model name. */
  model: string;
  /** Pipeline operation key. */
  operation?: string;
  /** Optional logger. */
  logger?: Logger;
  /** Max concurrent requests per individual API key shard (default: 5). */
  concurrencyPerKey?: number;
  /** Task executor per item. Receives item, original item index, and resolved Gemini target. */
  task: (item: TItem, index: number, target: GeminiTarget) => Promise<TResult>;
}

/**
 * Executes an array of async tasks with a maximum concurrency limit.
 */
async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Dispatches a batch of N items evenly across all configured API keys (e.g. 30 items -> 10-10-10)
 * executing in parallel across all healthy keys with automatic rate limiting and failover.
 *
 * @typeParam TItem - The input item type.
 * @typeParam TResult - The output result type.
 * @param options - Batch execution configuration.
 * @returns Array of results matching the exact original item ordering.
 */
export async function dispatchGeminiBatch<TItem, TResult>(
  options: GeminiBatchOptions<TItem, TResult>,
): Promise<TResult[]> {
  const { items, model, operation, logger, concurrencyPerKey = 5, task } = options;
  if (items.length === 0) return [];

  const pool = getGeminiKeyPool().keys;
  if (pool.length === 0) {
    throw new DailyQuotaExceededError(`gemini_${model}`);
  }

  const keyCount = pool.length;
  // Partition items into K shards: item i goes to shard (i % keyCount)
  const shards: { item: TItem; originalIndex: number }[][] = Array.from(
    { length: keyCount },
    () => [],
  );

  for (let i = 0; i < items.length; i++) {
    shards[i % keyCount].push({ item: items[i], originalIndex: i });
  }

  const finalResults: TResult[] = new Array(items.length);

  // Execute all K shards in parallel
  await Promise.all(
    shards.map(async (shardItems, shardKeyIndex) => {
      if (shardItems.length === 0) return;

      await mapConcurrent(shardItems, concurrencyPerKey, async ({ item, originalIndex }) => {
        const res = await dispatchGeminiCall<TResult>({
          model,
          operation,
          lane: "batch",
          targetKeyIndex: shardKeyIndex,
          logger,
          task: async (target) => await task(item, originalIndex, target),
        });
        finalResults[originalIndex] = res;
      });
    }),
  );

  return finalResults;
}
