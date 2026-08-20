interface SortableResource {
  id: number;
  publicationYear?: number | null;
}

/**
 * Sorts academic resources by publication year (newest first), then by id.
 *
 * @param items - Resources to sort.
 * @returns A new array sorted by the shared academic ordering.
 */
export function sortLibraryResources<T extends SortableResource>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const yearA = a.publicationYear ?? 0;
    const yearB = b.publicationYear ?? 0;
    if (yearA !== yearB) return yearB - yearA;

    return a.id - b.id;
  });
}
