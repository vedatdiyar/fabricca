import type { LiteraturePoolEntry, JuryArticle } from "@/lib/types";
import type { SubBoxItem, RawPaper } from "../literature-review-papers";

export interface BatchOrchestrationResult {
  poolEntries: LiteraturePoolEntry[];
  archivalBoxTitles: string[];
}

/** Aggregated result for one active sub-box after Phase 1. */
export interface SubBoxResult {
  boxType: string;
  subBoxDescription: string;
  subBox: SubBoxItem;
  thesisBoxId: number;
  rawPapers: RawPaper[];
}

export interface PoolItem {
  type: "raw";
  rawPaper: RawPaper;
}

export interface JuryEvalResult {
  thesisBoxId: number;
  subBoxTitle: string;
  articleTitle: string;
  openAlexId: string | null;
  isRelevant: boolean;
  tier?: "TIER_1" | "TIER_2" | "REJECT";
  relevanceScore: number;
  reasoning: string;
}

export interface SelectedArticleCandidate {
  thesisBoxId: number;
  subBoxTitle: string;
  originalTitle: string;
  originalAuthors: string[];
  relevanceScore: number;
  reasoning: string;
  doi: string | null;
  openalexId: string | null;
  publisher: string | null;
  publicationYear: number | null;
  originalAbstract: string | null;
  poolItem: PoolItem;
}

export interface SubBoxResultToPersist {
  subBoxTitle: string;
  thesisBoxId: number;
  articles: JuryArticle[];
}
