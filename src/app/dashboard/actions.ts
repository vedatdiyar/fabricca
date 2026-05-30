"use server";

export interface ThesisCoreData {
  id?: number;
  title: string;
  researchQuestion: string;
  argument: string;
  methodology: string;
  boxes?: {
    id: number;
    name: string;
    description: string | null;
    noteCount?: number;
  }[];
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
  source?: string;
  lang?: "TR" | "EN";
  boxId?: number;
  boxName?: string;
}

export interface RecommendationsResult {
  success: boolean;
  recommendations?: LiteratureRecommendation[];
  error?: string;
}

import {
  getThesisCoreAction as getThesisCore,
  resetThesisCoreAction as resetThesisCore,
} from "./_actions/thesis";
import {
  getAcademicRecommendationsAction as getAcademicRecommendations,
  discoverNewRecommendationsAction as discoverNewRecommendations,
} from "./_actions/recommendations";

export async function getThesisCoreAction(
  userId?: string,
): Promise<GetThesisCoreResult> {
  return getThesisCore(userId);
}

export async function resetThesisCoreAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  return resetThesisCore();
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
  boxId?: number,
): Promise<RecommendationsResult> {
  return discoverNewRecommendations(
    title,
    researchQuestion,
    argument,
    methodology,
    boxId,
  );
}
