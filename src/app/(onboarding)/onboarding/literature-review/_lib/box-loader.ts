/**
 * Shared box loading utilities for the literature-review module.
 * Single source of truth for box-map construction.
 */

/**
 * Builds a deduplicated title → ID map from a list of box records.
 * Throws on duplicate titles to prevent data corruption.
 *
 * @param allBoxes - Raw box rows (id, title) from the database
 * @returns A map of box title → box database ID
 */
export function buildBoxMap(
  allBoxes: {
    id: number;
    title: string;
    parentId: number | null;
    boxType: string | null;
  }[],
): Map<string, number> {
  const boxMap = new Map<string, number>();
  for (const b of allBoxes) {
    const isTarget =
      b.parentId !== null ||
      b.boxType === "PRIMARY_MATERIAL" ||
      b.boxType === "RELATED_THESES";

    if (!isTarget) continue;

    if (boxMap.has(b.title)) {
      throw new Error(
        `Duplicate box title found: "${b.title}". Please restart the onboarding process.`,
      );
    }
    boxMap.set(b.title, b.id);
  }
  return boxMap;
}
