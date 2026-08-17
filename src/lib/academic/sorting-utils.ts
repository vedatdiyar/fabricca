interface SortableResource {
  relevanceScore: number | null;
  id: number;
}

/**
 * Sorts academic resources by relevance score, then by id.
 *
 * @param items - Resources to sort.
 * @returns A new array sorted by the shared academic ordering.
 */
export function sortLibraryResources<T extends SortableResource>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const scoreA = a.relevanceScore ?? 0;
    const scoreB = b.relevanceScore ?? 0;
    if (scoreA !== scoreB) return scoreB - scoreA;

    return a.id - b.id;
  });
}
