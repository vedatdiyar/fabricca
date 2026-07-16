import type { Logger } from "@/lib/logger";
import type {
  AnalysisBadge,
  RelationshipBadge,
  TezaraThesisDetails,
} from "@/lib/types";
import type { LLMScoredItem } from "./analysis";

// ============================================================================
// Deterministic Decision Engine — 2-Stage Literatür Analizi
// Stage 1: Mutlak Özgünlük Kontrolü (DUPLICATE_THESIS_RISK)
// Stage 2: Akademik Katkı / Yararlanma Alanları (9 badges, priority order)
// ============================================================================

export type ThesisBucket = "RISK" | "CONTRIBUTION" | "IRRELEVANT";

export interface DecisionResult {
  thesisId: number;
  bucket: ThesisBucket;
  primaryBadge: AnalysisBadge;
  badges: AnalysisBadge[];
  relevanceScore: number;
}

export interface CalculatedComparisonItem {
  id: number;
  title: string;
  author: string;
  university: string;
  year: number;
  thesisType: string;
  department: string;
  yokPdfUrl?: string;
  abstract?: string;
  bucket: ThesisBucket;
  primaryBadge: AnalysisBadge;
  badges: AnalysisBadge[];
  relevanceScore: number;
  /** Individual LLM dimension scores for transparency */
  researchFocus: number;
  mainActors: number;
  temporalScope: { score: number; label: string };
  spatialScope: number;
  theoreticalFramework: number;
  methodology: number;
  mainClaim: number;
}

export interface CalculatedRelationshipsResult {
  globalRelationshipBadge: RelationshipBadge;
  comparisonTable: CalculatedComparisonItem[];
}

// ============================================================================
// applyDecisionEngine — 2-Stage Decision Engine
// ============================================================================

/**
 * Applies the 2-stage deterministic decision engine to a single LLM-scored item.
 *
 * Stage 1: All 7 dimensions === 100 → DUPLICATE_THESIS_RISK (RISK bucket).
 *   Gatekeeper: RF=0 AND MA=0 → IRRELEVANT_DATA (IRRELEVANT bucket).
 *
 * Stage 2: 9 badges checked in strict priority order (#1 → #9).
 *   #6 HISTORICAL_BASELINE_DATA uses temporalScope.label === "PAST".
 *   #7 FUTURE_PROSPECTIVE_CONTEXT uses temporalScope.label === "FUTURE".
 *
 * @param item - The raw LLM classification output
 * @returns DecisionResult with bucket, primary badge, badge set, and relevance score
 */
export function applyDecisionEngine(item: LLMScoredItem): DecisionResult {
  const {
    researchFocus,
    mainActors,
    temporalScope,
    spatialScope,
    theoreticalFramework,
    methodology,
    mainClaim,
    tez_id,
  } = item;
  const thesisId = Number(tez_id);

  const relevanceScore =
    researchFocus +
    mainActors +
    temporalScope.score +
    spatialScope +
    theoreticalFramework +
    methodology +
    mainClaim;

  // ── STAGE 1: Mutlak Özgünlük Kontrolü ────────────────────────────────────
  if (
    researchFocus === 100 &&
    mainActors === 100 &&
    temporalScope.score === 100 &&
    spatialScope === 100 &&
    theoreticalFramework === 100 &&
    methodology === 100 &&
    mainClaim === 100
  ) {
    return {
      thesisId,
      bucket: "RISK",
      primaryBadge: "DUPLICATE_THESIS_RISK",
      badges: ["DUPLICATE_THESIS_RISK"],
      relevanceScore,
    };
  }

  // ── Gatekeeper (Gürültü Kontrolü) ─────────────────────────────────────────
  if (researchFocus === 0 && mainActors === 0) {
    return {
      thesisId,
      bucket: "IRRELEVANT",
      primaryBadge: "IRRELEVANT_DATA",
      badges: ["IRRELEVANT_DATA"],
      relevanceScore,
    };
  }

  // ── STAGE 2: Akademik Katkı / Yararlanma Alanları ─────────────────────────
  // #1: EMPIRICAL_FOUNDATION_SOURCE
  if (
    researchFocus === 50 &&
    mainActors === 50 &&
    temporalScope.score === 100 &&
    spatialScope >= 50 &&
    (methodology >= 50 || theoreticalFramework >= 50)
  ) {
    return {
      thesisId,
      bucket: "CONTRIBUTION",
      primaryBadge: "EMPIRICAL_FOUNDATION_SOURCE",
      badges: ["EMPIRICAL_FOUNDATION_SOURCE"],
      relevanceScore,
    };
  }

  // #2: DIALECTICAL_DISCUSSION_SUPPORT
  if (mainClaim === 50) {
    return {
      thesisId,
      bucket: "CONTRIBUTION",
      primaryBadge: "DIALECTICAL_DISCUSSION_SUPPORT",
      badges: ["DIALECTICAL_DISCUSSION_SUPPORT"],
      relevanceScore,
    };
  }

  // #3: THEMATIC_SYNTHESIS_OPPORTUNITY
  if (
    researchFocus === 100 &&
    temporalScope.score === 100 &&
    spatialScope >= 50
  ) {
    return {
      thesisId,
      bucket: "CONTRIBUTION",
      primaryBadge: "THEMATIC_SYNTHESIS_OPPORTUNITY",
      badges: ["THEMATIC_SYNTHESIS_OPPORTUNITY"],
      relevanceScore,
    };
  }

  // #4: CROSS_CONTEXTUAL_VALIDATION
  if (researchFocus === 100 && spatialScope === 0) {
    return {
      thesisId,
      bucket: "CONTRIBUTION",
      primaryBadge: "CROSS_CONTEXTUAL_VALIDATION",
      badges: ["CROSS_CONTEXTUAL_VALIDATION"],
      relevanceScore,
    };
  }

  // #5: METHODOLOGICAL_AND_THEORETICAL_PEER
  if (
    researchFocus === 50 &&
    (theoreticalFramework === 100 || methodology === 100)
  ) {
    return {
      thesisId,
      bucket: "CONTRIBUTION",
      primaryBadge: "METHODOLOGICAL_AND_THEORETICAL_PEER",
      badges: ["METHODOLOGICAL_AND_THEORETICAL_PEER"],
      relevanceScore,
    };
  }

  // #6: HISTORICAL_BASELINE_DATA
  if (
    researchFocus === 50 &&
    temporalScope.score === 0 &&
    (mainActors === 50 || mainActors === 100) &&
    temporalScope.label === "PAST"
  ) {
    return {
      thesisId,
      bucket: "CONTRIBUTION",
      primaryBadge: "HISTORICAL_BASELINE_DATA",
      badges: ["HISTORICAL_BASELINE_DATA"],
      relevanceScore,
    };
  }

  // #7: FUTURE_PROSPECTIVE_CONTEXT
  if (
    researchFocus === 50 &&
    temporalScope.score === 0 &&
    (mainActors === 50 || mainActors === 100) &&
    temporalScope.label === "FUTURE"
  ) {
    return {
      thesisId,
      bucket: "CONTRIBUTION",
      primaryBadge: "FUTURE_PROSPECTIVE_CONTEXT",
      badges: ["FUTURE_PROSPECTIVE_CONTEXT"],
      relevanceScore,
    };
  }

  // #8: MACRO_STRUCTURAL_CONTEXT (TS control intentionally removed)
  if (
    researchFocus === 50 &&
    mainActors === 100 &&
    methodology === 0 &&
    theoreticalFramework === 0
  ) {
    return {
      thesisId,
      bucket: "CONTRIBUTION",
      primaryBadge: "MACRO_STRUCTURAL_CONTEXT",
      badges: ["MACRO_STRUCTURAL_CONTEXT"],
      relevanceScore,
    };
  }

  // #9: PARALLEL_LITERATURE_REFERENCE (fallback)
  return {
    thesisId,
    bucket: "CONTRIBUTION",
    primaryBadge: "PARALLEL_LITERATURE_REFERENCE",
    badges: ["PARALLEL_LITERATURE_REFERENCE"],
    relevanceScore,
  };
}

// ============================================================================
// calculateRelationships — Decision Engine + Global Badge
// ============================================================================

/**
 * Applies the 2-stage decision engine to each LLM-scored item,
 * merges with thesis details, and computes the global relationship badge.
 *
 * @param llmResults - The raw LLM classification results
 * @param validDetails - Candidate thesis details from Tezara
 * @param logger - Optional logger instance
 * @returns Global relationship badge and comparison table
 */
export function calculateRelationships(
  llmResults: LLMScoredItem[],
  validDetails: TezaraThesisDetails[],
  logger?: Logger,
): CalculatedRelationshipsResult {
  if (validDetails.length === 0 || llmResults.length === 0) {
    return {
      globalRelationshipBadge: "UNRELATED",
      comparisonTable: [],
    };
  }

  const detailsMap = new Map<number, TezaraThesisDetails>(
    validDetails.map((d) => [d.id, d]),
  );
  const items: CalculatedComparisonItem[] = [];

  for (const llmItem of llmResults) {
    const detail = detailsMap.get(Number(llmItem.tez_id));
    if (!detail) {
      logger?.warn("originality_hallucinated_id_filtered", {
        service: "originality",
        data: {
          context: "calculateRelationships",
          hallucinatedId: llmItem.tez_id,
        },
      });
      continue;
    }

    const decision = applyDecisionEngine(llmItem);

    items.push({
      id: detail.id,
      title: detail.title,
      author: detail.author,
      university: detail.university,
      year: detail.year,
      thesisType: detail.thesisType,
      department: detail.department,
      yokPdfUrl: detail.yokPdfUrl,
      abstract: detail.abstract,
      bucket: decision.bucket,
      primaryBadge: decision.primaryBadge,
      badges: decision.badges,
      relevanceScore: decision.relevanceScore,
      researchFocus: llmItem.researchFocus,
      mainActors: llmItem.mainActors,
      temporalScope: llmItem.temporalScope,
      spatialScope: llmItem.spatialScope,
      theoreticalFramework: llmItem.theoreticalFramework,
      methodology: llmItem.methodology,
      mainClaim: llmItem.mainClaim,
    });
  }

  let globalBadge: RelationshipBadge = "UNRELATED";
  const riskItems = items.filter((i) => i.bucket === "RISK");
  const contributionItems = items.filter((i) => i.bucket === "CONTRIBUTION");

  if (riskItems.length > 0) {
    globalBadge = "HIGH_RISK";
  } else if (contributionItems.length > 0) {
    globalBadge = "CONTRIBUTION_READY";
  }

  return {
    globalRelationshipBadge: globalBadge,
    comparisonTable: items,
  };
}
