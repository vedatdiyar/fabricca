import { cleanHtmlTags } from "@/lib/services/academic-sanitizer";
import { extractCleanDoi } from "@/lib/academic/utils";
import type { RawPaper, RefMetadata } from "../literature-review-papers";

/**
 * Parses an array of OpenAlex work records into RawPaper objects.
 * Filters by type (article/book-chapter/book) and language (en/tr).
 */
export function parseOpenAlexResults(
  results: Record<string, unknown>[],
): RawPaper[] {
  results = results.filter((work) => {
    const type = work.type as string | undefined;
    const lang = work.language as string | undefined;
    const isArticleOrBook =
      type === "article" || type === "book-chapter" || type === "book";
    const isAllowedLang = !lang || lang === "en" || lang === "tr";
    return isArticleOrBook && isAllowedLang;
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

    return {
      source: "openalex" as const,
      title: cleanHtmlTags((work.title as string) ?? ""),
      abstract: null,
      metadata,
      doi: extractCleanDoi(work.doi as string | null | undefined),
      url: null,
      authors:
        authorships?.map((a) => a.author?.display_name ?? "").filter(Boolean) ??
        [],
      year: null,
      publisher: null,
      openAlexId: (work.id as string) ?? null,
      isFoundational: false,
      relevanceScore: (rawScores[i] ?? 0) / safeMax,
      referencedWorks: Array.isArray(work.referenced_works)
        ? (work.referenced_works as string[])
        : [],
      citedByCount: (work.cited_by_count as number) ?? 0,
    };
  });
}

/**
 * Parses an array of OpenAlex work records into RefMetadata objects.
 * Does NOT filter by type — includes all work types for reference resolution.
 */
export function parseOpenAlexMetadataResults(
  results: Record<string, unknown>[],
): RefMetadata[] {
  return results.map((work) => {
    const authorships = Array.isArray(work.authorships)
      ? (work.authorships as { author?: { display_name?: string } }[])
      : [];

    return {
      id: (work.id as string) ?? "",
      title: (work.title as string) ?? "",
      authors: authorships
        .map((a) => a.author?.display_name ?? "")
        .filter(Boolean),
      year: null,
      workType: (work.type as string) ?? null,
      doi: (work.doi as string) ?? null,
      publisher: null,
      citedByCount: (work.cited_by_count as number) ?? 0,
    };
  });
}
