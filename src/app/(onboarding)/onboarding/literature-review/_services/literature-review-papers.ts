/** One sub-box with its own title and description (not the parent box's). */
export interface SubBoxItem {
  title: string;
  /** Sub-box's own description — this is what the jury evaluates against. */
  description: string;
  thesisBoxId: number;
  semanticQuery: string;
}

export interface SubBoxInput {
  /** Parent box DB id — used for archival bypass entries. */
  id: number;
  title: string;
  description: string;
  boxType?: string;
  subBoxes: SubBoxItem[];
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

export type LiteratureSourceChannel =
  "openalex" | "semantic_scholar" | "exa" | "qdrant";

export interface RawPaper {
  source: LiteratureSourceChannel;
  title: string | null;
  abstract?: string | null;
  metadata: string | null;
  doi: string | null;
  authors: string[];
  year: number | null;
  publisher: string | null;
  openAlexId: string | null;
  relevanceScore: number;
  citedByCount?: number;
  url?: string | null;
  publicationType?: string | null;
}
