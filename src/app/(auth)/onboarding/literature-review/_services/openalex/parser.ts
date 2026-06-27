import { extractCleanDoi } from "../_shared";
import type { RawPaper } from "../literature-review-papers";

function resolveAbstractInvertedIndex(
  invertedIndex: Record<string, number[]> | null | undefined,
): string | null {
  if (!invertedIndex) return null;
  const entries: [number, string][] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      entries.push([pos, word]);
    }
  }
  entries.sort(([a], [b]) => a - b);
  return entries.map(([, word]) => word).join(" ");
}

function parseOpenAlexResults(results: Record<string, unknown>[]): RawPaper[] {
  results = results.filter((work) => {
    const type = work.type as string | undefined;
    return type === "article" || type === "book-chapter" || type === "book";
  });

  const rawScores = results.map(
    (work) => (work.relevance_score as number) ?? 0,
  );
  const maxScore = Math.max(...rawScores, 0);
  const safeMax = maxScore > 0 ? maxScore : 1;

  return results.map((work, i) => {
    const topics = work.topics as
      | {
          display_name?: string;
          subfield?: { display_name?: string };
          field?: { display_name?: string };
          domain?: { display_name?: string };
        }[]
      | undefined;
    const authorships = work.authorships as
      { author?: { display_name?: string } }[] | null | undefined;
    const primaryLocation = work.primary_location as
      | {
          landing_page_url?: string;
          source?: { display_name?: string };
        }
      | null
      | undefined;

    const primaryTopic = topics?.[0];
    const topicName = primaryTopic?.display_name ?? null;

    const hierarchyParts: string[] = [];
    const domain = primaryTopic?.domain?.display_name;
    const field = primaryTopic?.field?.display_name;
    const subfield = primaryTopic?.subfield?.display_name;
    if (domain) hierarchyParts.push(domain);
    if (field) hierarchyParts.push(field);
    if (subfield) hierarchyParts.push(subfield);

    const metadataParts: string[] = [];
    if (topicName) metadataParts.push(`Topic: ${topicName}`);
    if (hierarchyParts.length > 0)
      metadataParts.push(`Hierarchy: ${hierarchyParts.join(" > ")}`);
    const metadata = metadataParts.length > 0 ? metadataParts.join(". ") : null;

    const invertedIndex = work.abstract_inverted_index as
      Record<string, number[]> | null | undefined;

    return {
      source: "openalex" as const,
      title: (work.title as string) ?? "",
      abstract: resolveAbstractInvertedIndex(invertedIndex),
      metadata,
      doi: extractCleanDoi(work.doi as string | null | undefined),
      url: primaryLocation?.landing_page_url ?? (work.id as string) ?? null,
      authors:
        authorships?.map((a) => a.author?.display_name ?? "").filter(Boolean) ??
        [],
      year: (work.publication_year as number) ?? null,
      publisher: primaryLocation?.source?.display_name ?? null,
      openAlexId: (work.id as string) ?? null,
      isFoundational: false,
      relevanceScore: (rawScores[i] ?? 0) / safeMax,
    };
  });
}

export { resolveAbstractInvertedIndex, parseOpenAlexResults };
