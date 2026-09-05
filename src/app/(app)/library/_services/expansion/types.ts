/**
 * Candidate source item normalized across backward parsing and OpenAlex.
 */
export interface CandidateSource {
  title: string;
  authors: string[];
  publisher?: string;
  publicationYear?: number;
  doi?: string;
  openalexId?: string;
  corpusId?: number;
  relevanceScore?: number;
  pdfUrl?: string;
  sourceOrigin: "backward" | "forward_openalex" | "recommendation_s2";
  citationCount?: number;
  influentialCitationCount?: number;
  rawParsedRef?: string;
}

/**
 * Raw paper item returned by Semantic Scholar Recommendations API v1.0.
 */
export interface S2RecommendationItem {
  paperId: string;
  corpusId?: number;
  externalIds?: {
    DOI?: string;
    CorpusId?: number;
    ArXiv?: string;
    PubMed?: string;
    [key: string]: string | number | undefined;
  };
  url?: string;
  title: string;
  abstract?: string;
  venue?: string;
  year?: number;
  referenceCount?: number;
  citationCount?: number;
  influentialCitationCount?: number;
  isOpenAccess?: boolean;
  openAccessPdf?: {
    url?: string;
    status?: string;
    license?: string;
  };
  fieldsOfStudy?: string[];
  authors?: Array<{
    authorId?: string;
    name: string;
  }>;
}

export interface S2RecommendationsResponse {
  recommendedPapers: S2RecommendationItem[];
}


/**
 * Result returned by the Literature Expansion Orchestrator.
 */
export interface ExpansionResult {
  boxId: number;
  expansionCycle: number;
  previousActiveSeedIds: number[];
  newActiveSeedIds: number[];
  addedSources: {
    id: number;
    title: string;
    sourceOrigin: string;
  }[];
}
