import { Outline, Source } from "@/db/schema";

/**
 * Determines whether an outline title corresponds to an intro/conclusion chapter.
 *
 * @param title - The outline title to inspect.
 * @returns True when the title contains a Turkish intro or conclusion keyword.
 */
export function isIntroOrConclusion(title: string): boolean {
  const titleUpper = title.toLocaleUpperCase("tr-TR");
  return (
    titleUpper.includes("GİRİŞ") ||
    titleUpper.includes("GIRIS") ||
    titleUpper.includes("SONUÇ") ||
    titleUpper.includes("SONUC")
  );
}

/**
 * Filters sources by title, author or publisher using Turkish-locale matching.
 *
 * @param sources - The full source list to filter.
 * @param query - The raw search query; empty/whitespace returns the input unchanged.
 * @returns The filtered source list.
 */
export function filterSourcesByQuery(
  sources: Source[],
  query: string,
): Source[] {
  if (!query.trim()) return sources;
  const q = query.toLocaleLowerCase("tr-TR");
  return sources.filter(
    (s) =>
      s.title.toLocaleLowerCase("tr-TR").includes(q) ||
      (s.authors &&
        s.authors.some((a) => a.toLocaleLowerCase("tr-TR").includes(q))) ||
      (s.publisher && s.publisher.toLocaleLowerCase("tr-TR").includes(q)),
  );
}

/**
 * Filters root outlines, keeping a root when its own title or one of its sub-sections matches the query.
 *
 * @param rootOutlines - The sorted root outline list.
 * @param outlinesList - The full outline list used for sub-section matching.
 * @param query - The raw search query; empty/whitespace returns the input unchanged.
 * @returns The filtered root outline list.
 */
export function filterRootOutlinesByQuery(
  rootOutlines: Outline[],
  outlinesList: Outline[],
  query: string,
): Outline[] {
  if (!query.trim()) return rootOutlines;
  const q = query.toLocaleLowerCase("tr-TR");

  return rootOutlines.filter((root) => {
    const rootMatch = root.title.toLocaleLowerCase("tr-TR").includes(q);
    const subMatch = outlinesList.some(
      (o) =>
        o.parentId === root.id &&
        o.title.toLocaleLowerCase("tr-TR").includes(q),
    );
    return rootMatch || subMatch;
  });
}
