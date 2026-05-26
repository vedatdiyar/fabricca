"use server";

export interface ThesisCoreData {
  title: string;
  researchQuestion: string;
  argument: string;
  methodology: string;
}

export interface GetThesisCoreResult {
  success: boolean;
  data?: ThesisCoreData | null;
  error?: string;
}

export interface LiteratureRecommendation {
  paperId?: string;
  title: string;
  authors: string;
  year: string;
  relevance: string;
  url?: string;
  citationCount?: number;
  source?: "DergiPark" | "Semantic Scholar";
  lang?: "TR" | "EN";
}

export interface RecommendationsResult {
  success: boolean;
  recommendations?: LiteratureRecommendation[];
  error?: string;
}

// Re-export actions from modular components
export { getThesisCoreAction } from "./_actions/thesis";
export {
  getAcademicRecommendationsAction,
  discoverNewRecommendationsAction,
} from "./_actions/recommendations";
