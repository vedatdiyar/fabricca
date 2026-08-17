import {
  isKeyRpdExhausted,
  isKeyRpmCoolingDown,
  getKeyUsageCount,
  getNextRoundRobinOffset,
} from "./scheduler-state";

/**
 * Returns prioritized key indices for dispatching, balanced by least-used metrics
 * with round-robin tie-breaking.
 *
 * @param model - The target Gemini model name.
 * @param pool - The ordered array of configured API key strings.
 * @returns Array of candidate pool indices in execution priority order.
 */
export function getBalancedKeyCandidates(
  model: string,
  pool: readonly string[],
): number[] {
  // 1. Filter out keys that have hit their daily quota (RPD) today
  const nonRpdIndices: number[] = [];
  for (let i = 0; i < pool.length; i++) {
    if (!isKeyRpdExhausted(model, pool[i]) || pool.length === 1) {
      nonRpdIndices.push(i);
    }
  }

  if (nonRpdIndices.length === 0) return [];

  // 2. Separate ready keys (not in RPM cooldown) from cooling-down keys
  const readyIndices = nonRpdIndices.filter(
    (idx) => !isKeyRpmCoolingDown(model, pool[idx]),
  );

  // If all non-RPD keys happen to be in cooldown, fall back to trying all non-RPD keys
  const baseIndices = readyIndices.length > 0 ? readyIndices : nonRpdIndices;

  // 3. Apply round-robin offset for tie-breaking
  const rrOffset = getNextRoundRobinOffset(baseIndices.length);
  const rotated = [
    ...baseIndices.slice(rrOffset),
    ...baseIndices.slice(0, rrOffset),
  ];

  // 4. Stable sort by least-used call count
  rotated.sort((a, b) => {
    const usageA = getKeyUsageCount(pool[a]);
    const usageB = getKeyUsageCount(pool[b]);
    return usageA - usageB;
  });

  return rotated;
}
