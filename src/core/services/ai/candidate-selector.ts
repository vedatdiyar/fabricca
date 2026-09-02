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
 * Priorities:
 * 1. If targetKeyIndex is provided and healthy, prioritize it.
 * 2. Filter out keys that have hit their daily quota (RPD).
 * 3. Prefer ready keys (not in RPM cooldown).
 * 4. Sort by lowest active in-flight load, then lowest historical usage with round-robin tie breaking.
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

  // If all non-RPD keys are cooling down, try all non-RPD keys
  const baseIndices = readyIndices.length > 0 ? readyIndices : nonRpdIndices;

  // 4. Stable sort with round-robin offset for tie-breaking:
  // Primary sort: lowest in-flight active load (prevents concurrent dogpiling).
  // Secondary sort: lowest historical successful call count (long-term fairness).
  const rrOffset = getNextRoundRobinOffset(baseIndices.length);
  const rotated = [
    ...baseIndices.slice(rrOffset),
    ...baseIndices.slice(0, rrOffset),
  ];

  rotated.sort((a, b) => {
    const inFlightA = getKeyInFlightCount(pool[a]);
    const inFlightB = getKeyInFlightCount(pool[b]);
    if (inFlightA !== inFlightB) {
      return inFlightA - inFlightB;
    }
    const usageA = getKeyUsageCount(pool[a]);
    const usageB = getKeyUsageCount(pool[b]);
    return usageA - usageB;
  });

  return rotated;
}
