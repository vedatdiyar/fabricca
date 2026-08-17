/**
 * Generates a unique flow identifier in the form fl_<timestamp36>_<random>.
 *
 * @returns Unique flow identifier string.
 */
export function createFlowId(): string {
  return `fl_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}
