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
  sourceOrigin: "backward" | "forward_openalex";
  citationCount?: number;
  influentialCitationCount?: number;
  rawParsedRef?: string;
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
