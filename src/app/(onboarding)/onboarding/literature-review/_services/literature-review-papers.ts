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

export interface RefMetadata {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  workType: string | null;
  doi: string | null;
  publisher: string | null;
  citedByCount: number;
}

export interface RawPaper {
  source: "openalex";
  title: string | null;
  metadata: string | null;
  doi: string | null;
  url: string | null;
  authors: string[];
  year: number | null;
  publisher: string | null;
  openAlexId: string | null;
  isFoundational: boolean;
  relevanceScore: number;
  referencedWorks?: string[];
  citedByCount?: number;
}
