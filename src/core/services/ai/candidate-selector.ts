import {
  isKeyRpdExhausted,
  isKeyRpmCoolingDown,
  getKeyUsageCount,
  getKeyInFlightCount,
  getNextRoundRobinOffset,
} from "./scheduler-state";

export interface CandidateSelectorOptions {
  lane?: "interactive" | "batch";
  targetKeyIndex?: number;
}

/**
 * Returns prioritized key indices for dispatching.
 *
 * For "interactive" lane (VIP Lane):
 * - Prioritizes keys with lowest active in-flight load, then lowest historical usage.
 * - Guarantees live chat / interactive streams start on the least-loaded healthy key immediately.
 *
 * For "batch" lane:
 * - If targetKeyIndex is provided (sharded batch), prioritizes targetKeyIndex if healthy,
 *   falling back to other healthy keys on errors.
 * - Otherwise balances by least-used historical metrics with round-robin tie breaking.
 *
 * @param model - The target Gemini model name.
 * @param pool - The ordered array of configured API key strings.
 * @param options - Lane and optional target key index.
 * @returns Array of candidate pool indices in execution priority order.
 */
export function getBalancedKeyCandidates(
  model: string,
  pool: readonly string[],
  options?: CandidateSelectorOptions,
): number[] {
  const lane = options?.lane ?? "batch";
  const targetKeyIndex = options?.targetKeyIndex;

  // 1. If targetKeyIndex is explicitly provided and healthy, prioritize it
  if (
    targetKeyIndex !== undefined &&
    targetKeyIndex >= 0 &&
    targetKeyIndex < pool.length
  ) {
    if (
      !isKeyRpdExhausted(model, pool[targetKeyIndex]) &&
      !isKeyRpmCoolingDown(model, pool[targetKeyIndex])
    ) {
      const remaining = pool
        .map((_, i) => i)
        .filter(
          (i) => i !== targetKeyIndex && !isKeyRpdExhausted(model, pool[i]),
        );
      return [targetKeyIndex, ...remaining];
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

  // 4. If VIP / Interactive lane, sort primarily by lowest in-flight active load, then usage count
  if (lane === "interactive") {
    const candidates = [...baseIndices];
    candidates.sort((a, b) => {
      const inFlightA = getKeyInFlightCount(pool[a]);
      const inFlightB = getKeyInFlightCount(pool[b]);
      if (inFlightA !== inFlightB) {
        return inFlightA - inFlightB;
      }
      const usageA = getKeyUsageCount(pool[a]);
      const usageB = getKeyUsageCount(pool[b]);
      return usageA - usageB;
    });
    return candidates;
  }

  // 5. For standard batch calls, apply round-robin offset for tie-breaking
  const rrOffset = getNextRoundRobinOffset(baseIndices.length);
  const rotated = [
    ...baseIndices.slice(rrOffset),
    ...baseIndices.slice(0, rrOffset),
  ];

  // 6. Stable sort: least-used historical call count
  rotated.sort((a, b) => {
    const usageA = getKeyUsageCount(pool[a]);
    const usageB = getKeyUsageCount(pool[b]);
    return usageA - usageB;
  });

  return rotated;
}
