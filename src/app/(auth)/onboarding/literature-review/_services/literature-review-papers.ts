/**
 * Shared types and utilities for literature review paper processing.
 */

import type { FoundationalQuery } from "@/lib/types";

// ============================================================================
// Types
// ============================================================================

export interface SubBoxItem {
  title: string;
  semanticQuery: string;
  foundationalQueries: FoundationalQuery[];
}

export interface SubBoxInput {
  title: string;
  description: string;
  boxType?: string;
  subBoxes: SubBoxItem[];
  foundationalQueries: FoundationalQuery[];
}

export interface RawPaper {
  source: "openalex";
  title: string | null;
  abstract: string | null;
  metadata: string | null;
  doi: string | null;
  url: string | null;
  authors: string[];
  year: number | null;
  publisher: string | null;
  openAlexId: string | null;
  isFoundational: boolean;
  relevanceScore: number;
  subBoxId?: string;
}

export interface ValidatedPaper {
  title: string;
  abstract: string | null;
  metadata: string | null;
  doi: string | null;
  url: string | null;
  authors: string[];
  year: number | null;
  publisher: string | null;
  openAlexId: string | null;
  isFoundational: boolean;
  relevanceScore: number;
  subBoxId?: string;
}

// ============================================================================
// DOI Merge & Deduplication
// ============================================================================

export function mergePapers(papers: RawPaper[]): ValidatedPaper[] {
  const doiMap = new Map<string, ValidatedPaper>();
  const openAlexIdMap = new Map<string, ValidatedPaper>();
  const noDoiPapers: ValidatedPaper[] = [];
  const seenTitleKeys = new Set<string>();

  function ingest(raw: RawPaper): void {
    const paper: ValidatedPaper = {
      title: raw.title ?? "",
      abstract: raw.abstract,
      metadata: raw.metadata,
      doi: raw.doi,
      url: raw.url,
      authors: [...raw.authors],
      year: raw.year,
      publisher: raw.publisher,
      openAlexId: raw.openAlexId,
      isFoundational: raw.isFoundational,
      relevanceScore: raw.relevanceScore,
      subBoxId: raw.subBoxId,
    };

    if (paper.doi) {
      const existing = doiMap.get(paper.doi);
      if (existing) {
        existing.abstract = existing.abstract ?? paper.abstract;
        existing.metadata = existing.metadata ?? paper.metadata;
        existing.url = existing.url ?? paper.url;
        existing.year = existing.year ?? paper.year;
        existing.publisher = existing.publisher ?? paper.publisher;
        existing.openAlexId = existing.openAlexId ?? paper.openAlexId;
        if (paper.isFoundational) existing.isFoundational = true;
        if (paper.relevanceScore > existing.relevanceScore)
          existing.relevanceScore = paper.relevanceScore;
        const existingSet = new Set(existing.authors);
        for (const a of paper.authors) {
          if (!existingSet.has(a)) {
            existing.authors.push(a);
            existingSet.add(a);
          }
        }
      } else {
        doiMap.set(paper.doi, { ...paper });
      }
    } else if (paper.openAlexId) {
      const existing = openAlexIdMap.get(paper.openAlexId);
      if (existing) {
        existing.abstract = existing.abstract ?? paper.abstract;
        existing.metadata = existing.metadata ?? paper.metadata;
        existing.url = existing.url ?? paper.url;
        existing.year = existing.year ?? paper.year;
        existing.publisher = existing.publisher ?? paper.publisher;
        if (paper.isFoundational) existing.isFoundational = true;
        if (paper.relevanceScore > existing.relevanceScore)
          existing.relevanceScore = paper.relevanceScore;
      } else {
        openAlexIdMap.set(paper.openAlexId, { ...paper });
      }
    } else {
      const titleKey = paper.title.toLowerCase().trim().slice(0, 80);
      if (paper.title && !seenTitleKeys.has(titleKey)) {
        seenTitleKeys.add(titleKey);
        noDoiPapers.push(paper);
      }
    }
  }

  for (const raw of papers) ingest(raw);
  const all = [...doiMap.values(), ...openAlexIdMap.values(), ...noDoiPapers];
  all.sort((a, b) => {
    if (a.isFoundational && !b.isFoundational) return -1;
    if (!a.isFoundational && b.isFoundational) return 1;
    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    return (a.title || "").localeCompare(b.title || "");
  });
  return all;
}
