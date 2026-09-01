import {
  isKeyRpdExhausted,
  isKeyRpmCoolingDown,
  getKeyUsageCount,
  getNextRoundRobinOffset,
} from "./scheduler-state";

/**
 * Returns prioritized key indices for dispatching, balanced by least-used historical metrics
 * and round-robin tie-breaking across sequential operations.
 *
 * Parallel batch calls (<= 15 requests) remain bound to a single healthy key without intra-batch
 * in-flight scattering.
 *
 * @param model - The target Gemini model name.
 * @param pool - The ordered array of configured API key strings.
 * @param pinnedKeyIndex - Optional pinned 0-based key index to prioritize for a batch.
 * @returns Array of candidate pool indices in execution priority order.
 */
export function getBalancedKeyCandidates(
  model: string,
  pool: readonly string[],
  pinnedKeyIndex?: number,
): number[] {
  // 1. If a pinned key index is provided and valid, prioritize it first
  if (
    pinnedKeyIndex !== undefined &&
    pinnedKeyIndex >= 0 &&
    pinnedKeyIndex < pool.length
  ) {
    if (!isKeyRpdExhausted(model, pool[pinnedKeyIndex])) {
      const remaining = pool
        .map((_, i) => i)
        .filter(
          (i) => i !== pinnedKeyIndex && !isKeyRpdExhausted(model, pool[i]),
        );
      return [pinnedKeyIndex, ...remaining];
    }
  }

  // 2. Filter out keys that have hit their daily quota (RPD) today
  const nonRpdIndices: number[] = [];
  for (let i = 0; i < pool.length; i++) {
    if (!isKeyRpdExhausted(model, pool[i]) || pool.length === 1) {
      nonRpdIndices.push(i);
    }
  }

  if (nonRpdIndices.length === 0) return [];

  // 3. Separate ready keys (not in RPM cooldown) from cooling-down keys
  const readyIndices = nonRpdIndices.filter(
    (idx) => !isKeyRpmCoolingDown(model, pool[idx]),
  );

  // If all non-RPD keys happen to be in cooldown, fall back to trying all non-RPD keys
  const baseIndices = readyIndices.length > 0 ? readyIndices : nonRpdIndices;

  // 4. Apply round-robin offset for tie-breaking across operations
  const rrOffset = getNextRoundRobinOffset(baseIndices.length);
  const rotated = [
    ...baseIndices.slice(rrOffset),
    ...baseIndices.slice(0, rrOffset),
  ];

  // 5. Stable sort: least-used historical call count (without intra-batch inFlight splitting)
  rotated.sort((a, b) => {
    const usageA = getKeyUsageCount(pool[a]);
    const usageB = getKeyUsageCount(pool[b]);
    return usageA - usageB;
  });

  return rotated;
}
