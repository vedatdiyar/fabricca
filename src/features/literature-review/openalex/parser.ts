import { cleanHtmlTags } from "@/lib/services/academic-sanitizer";
import {
  extractCleanDoi,
  extractOpenAlexId,
  resolveAbstractInvertedIndex,
} from "@/lib/academic/utils";
import type { RawPaper, RefMetadata } from "../literature-review-papers";

/**
 * Parses OpenAlex work records into RawPaper objects, filtering by type and language.
 *
 * @param results - The raw OpenAlex work records to parse.
 * @returns The parsed raw papers.
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

  return results.map((work) => {
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

    const abstractInvertedIndex = work.abstract_inverted_index as Record<
      string,
      number[]
    > | null;

    return {
      source: "openalex" as const,
      title: cleanHtmlTags((work.title as string) ?? ""),
      abstract: resolveAbstractInvertedIndex(abstractInvertedIndex),
      metadata,
      doi: extractCleanDoi(work.doi as string | null | undefined),
      authors:
        authorships?.map((a) => a.author?.display_name ?? "").filter(Boolean) ??
        [],
      year: null,
      publisher: null,
      openAlexId: extractOpenAlexId(work.id as string | null | undefined),
      relevanceScore: (work.relevance_score as number) ?? 0,
      referencedWorks: Array.isArray(work.referenced_works)
        ? (work.referenced_works as string[])
        : [],
      citedByCount: (work.cited_by_count as number) ?? 0,
    };
  });
}

/**
 * Parses OpenAlex work records into RefMetadata objects without filtering by type.
 *
 * @param results - The raw OpenAlex work records to parse.
 * @returns The parsed reference metadata records.
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
