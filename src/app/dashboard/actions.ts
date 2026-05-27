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
  source?: "OpenAlex" | "Semantic Scholar";
  lang?: "TR" | "EN";
  boxId?: number;
  boxName?: string;
}

export interface RecommendationsResult {
  success: boolean;
  recommendations?: LiteratureRecommendation[];
  error?: string;
}

import { getThesisCoreAction as getThesisCore } from "./_actions/thesis";
import {
  getAcademicRecommendationsAction as getAcademicRecommendations,
  discoverNewRecommendationsAction as discoverNewRecommendations,
} from "./_actions/recommendations";

export async function getThesisCoreAction(
  userId?: string,
): Promise<GetThesisCoreResult> {
  return getThesisCore(userId);
}

export async function getAcademicRecommendationsAction(
  title: string,
  researchQuestion: string,
  argument: string,
  methodology: string,
): Promise<RecommendationsResult> {
  return getAcademicRecommendations(
    title,
    researchQuestion,
    argument,
    methodology,
  );
}

export async function discoverNewRecommendationsAction(
  title: string,
  researchQuestion: string,
  argument: string,
  methodology: string,
): Promise<RecommendationsResult> {
  return discoverNewRecommendations(
    title,
    researchQuestion,
    argument,
    methodology,
  );
}
