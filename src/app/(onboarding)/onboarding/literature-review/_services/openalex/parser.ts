import { cleanHtmlTags } from "@/core/services/academic";
import {
  extractCleanDoi,
  extractOpenAlexId,
  resolveAbstractInvertedIndex,
} from "@/lib/academic/utils";
import type { RawPaper, RefMetadata } from "../literature-review-papers";

/**
 * Detects whether a raw OpenAlex work is a book review, editorial note,
 * or journal review entry misclassified as an article.
 *
 * @param work - Raw OpenAlex work record
 * @returns True if the work matches book review heuristics
 */
export function isSuspectedBookReview(work: Record<string, unknown>): boolean {
  const type = work.type as string | undefined;
  const title = ((work.title as string) ?? "").trim();
  const primaryLoc = work.primary_location as
    | {
        source?: {
          display_name?: string;
          type?: string;
        };
      }
    | null
    | undefined;

  const sourceName = primaryLoc?.source?.display_name ?? "";
  const sourceType = primaryLoc?.source?.type ?? "";

  // 1. Explicit OpenAlex Type
  if (type === "book-review") {
    return true;
  }

  // Legitimate books and chapters shouldn't be falsely flagged by publisher names
  if (type === "book" || type === "book-chapter") {
    const lowerTitle = title.toLowerCase();
    return (
      lowerTitle.startsWith("book review") ||
      lowerTitle.startsWith("review of:") ||
      lowerTitle.includes("(book review)")
    );
  }

  const lowerTitle = title.toLowerCase();
  const lowerSource = sourceName.toLowerCase();

  // 2. Source checks (e.g. Review journals)
  if (
    lowerSource.includes("journal of reviews") ||
    lowerSource.includes("book review") ||
    sourceType === "review"
  ) {
    return true;
  }

  // 3. Explicit review prefixes / phrases in title
  if (
    lowerTitle.startsWith("book review") ||
    lowerTitle.startsWith("review of:") ||
    lowerTitle.startsWith("review of ") ||
    lowerTitle.startsWith("review on:") ||
    lowerTitle.startsWith("review on ") ||
    lowerTitle.startsWith("a review of the book") ||
    lowerTitle.includes("(book review)") ||
    lowerTitle.includes("[book review]") ||
    lowerTitle.endsWith("book review") ||
    lowerTitle.endsWith("(recensión)") ||
    lowerTitle.includes("recensão:") ||
    lowerTitle.includes("compte rendu")
  ) {
    return true;
  }

  // 4. Pagination / Physical Book Metadata embedded in Title (e.g. "Pp. 265", "Pp XIII, 265", "págs.")
  if (
    /\bpp\.?\s*([0-9ivxlcdm]+|\d+)/i.test(title) ||
    /\bpágs\.?/i.test(title) ||
    /\b\d+\s*pp\b/i.test(title) ||
    /\b\d+\s*pages\b/i.test(title)
  ) {
    return true;
  }

  // 5. Publisher/City embedded in Title of an Article (articles don't have "London: Longman" or "Londres: Routledge" in title unless reviewing a book)
  const publisherKeywords = [
    "routledge",
    "cambridge:",
    "oxford:",
    "polity",
    "sage",
    "pearson",
    "springer",
    "palgrave",
    "longman",
    "londres:",
    "london:",
    "new york:",
  ];
  if (publisherKeywords.some((kw) => lowerTitle.includes(kw))) {
    if (!lowerTitle.startsWith("in ") && !lowerTitle.includes("in: ")) {
      return true;
    }
  }

  // 6. Title starts with "Author Name, Title" pattern where listed name is NOT in authors list
  // Example: "Norman Fairclough, Analyzing discourse..." (Actual author in authorships is Seyyed‐Abdolhamid Mirhosseini)
  const authorCommaMatch = title.match(
    /^([A-ZÇĞİÖŞÜ][a-zA-ZçğıöşüÇĞİÖŞÜ\s\.\-]{2,30}),\s+([A-ZÇĞİÖŞÜ].*)/,
  );
  if (authorCommaMatch) {
    const titleAuthorPart = authorCommaMatch[1].toLowerCase().trim();
    const authorships = work.authorships as
      { author?: { display_name?: string } }[] | null | undefined;
    const actualAuthors = (authorships ?? [])
      .map((a) => a.author?.display_name?.toLowerCase() ?? "")
      .filter(Boolean);

    const authorMatches = actualAuthors.some(
      (a) =>
        a.includes(titleAuthorPart) ||
        titleAuthorPart.includes(a.split(" ").pop() || "___"),
    );

    if (!authorMatches && actualAuthors.length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Parses OpenAlex work records into RawPaper objects, filtering by language only.
 * Nothing is dropped by type: review/chapter records may carry a canonical work's
 * citations and authorship signals, so they flow downstream where the parent-book
 * resolver heals title/authors and keeps the most-cited record ID.
 *
 * @param results - The raw OpenAlex work records to parse.
 * @returns The parsed raw papers.
 */
export function parseOpenAlexResults(
  results: Record<string, unknown>[],
): RawPaper[] {
  results = results.filter((work) => {
    const lang = work.language as string | undefined;
    return !lang || lang === "en" || lang === "tr";
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

    const primaryLoc = work.primary_location as
      | {
          source?: {
            display_name?: string;
            type?: string;
          };
        }
      | null
      | undefined;
    const hostVenue = work.host_venue as
      | {
          display_name?: string;
        }
      | null
      | undefined;

    const publisher =
      primaryLoc?.source?.display_name || hostVenue?.display_name || null;
    const year = (work.publication_year as number) ?? null;
    const workType = work.type as string | undefined;
    const isBook = workType === "book" || workType === "monograph";
    const isSection = workType === "book-chapter";
    const isReview = workType === "book-review" || isSuspectedBookReview(work);
    const publicationType = isBook
      ? "Kitap / Monografi"
      : isSection
        ? "Kitap Bölümü"
        : isReview
          ? "Kitap İncelemesi"
          : "Makale";

    return {
      source: "openalex" as const,
      title: cleanHtmlTags((work.title as string) ?? ""),
      abstract: resolveAbstractInvertedIndex(abstractInvertedIndex),
      metadata,
      doi: extractCleanDoi(work.doi as string | null | undefined),
      authors:
        authorships?.map((a) => a.author?.display_name ?? "").filter(Boolean) ??
        [],
      year,
      publisher,
      openAlexId: extractOpenAlexId(work.id as string | null | undefined),
      relevanceScore: (work.relevance_score as number) ?? 0,
      referencedWorks: Array.isArray(work.referenced_works)
        ? (work.referenced_works as string[])
        : [],
      citedByCount: (work.cited_by_count as number) ?? 0,
      publicationType,
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
    const primaryLoc = work.primary_location as
      | {
          source?: {
            display_name?: string;
          };
        }
      | null
      | undefined;

    return {
      id: (work.id as string) ?? "",
      title: (work.title as string) ?? "",
      authors: authorships
        .map((a) => a.author?.display_name ?? "")
        .filter(Boolean),

      year: (work.publication_year as number) ?? null,
      workType: (work.type as string) ?? null,
      doi: (work.doi as string) ?? null,
      publisher: primaryLoc?.source?.display_name ?? null,
      citedByCount: (work.cited_by_count as number) ?? 0,
    };
  });
}
