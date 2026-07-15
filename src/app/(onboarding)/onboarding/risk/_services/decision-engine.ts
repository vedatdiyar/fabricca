import type { Logger } from "@/lib/logger";
import type {
  AnalysisBadge,
  RelationshipBadge,
  TezaraThesisDetails,
} from "@/lib/types";
import type { LLMScoredItem } from "./analysis";

// ============================================================================
// Deterministic Decision Engine — One thesis, "two questions, one gate" logic
// ============================================================================

export type ThesisBucket = "RISK" | "CONTRIBUTION" | "IRRELEVANT";

export interface DecisionResult {
  thesisId: number;
  bucket: ThesisBucket;
  primaryBadge: AnalysisBadge;
  badges: AnalysisBadge[];
  analysisNote: string;
}

// ============================================================================
// Calculated Comparison Item — Thesis details + decision engine result
// ============================================================================

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
  analysisNote: string;
}

export interface CalculatedRelationshipsResult {
  globalRelationshipBadge: RelationshipBadge;
  comparisonTable: CalculatedComparisonItem[];
}

// ============================================================================
// applyDecisionEngine — Deterministic "two questions, one gate" logic
// ============================================================================

/**
 * Applies the deterministic decision engine to a single LLM-scored item.
 *
 * @param item - The raw LLM classification output
 * @returns DecisionResult with bucket, primary badge, and badge set
 */
export function applyDecisionEngine(item: LLMScoredItem): DecisionResult {
  const {
    researchFocus,
    mainActors,
    temporalScope,
    theoreticalFramework,
    methodology,
    mainClaim,
    tez_id,
    analysisNote,
  } = item;
  const thesisId = Number(tez_id);

  // ── STAGE 1: Gatekeeper (Noise Control) ─────────────────────────────────
  if (researchFocus === 0 || mainActors === 0) {
    return {
      thesisId,
      bucket: "IRRELEVANT",
      primaryBadge: "IRRELEVANT_DATA",
      badges: ["IRRELEVANT_DATA"],
      analysisNote:
        analysisNote ||
        "Bu tez çalışmanızla doğrudan bir ilgi veya katkı ilişkisi taşımamaktadır.",
    };
  }

  // ── STAGE 2: Threat Assessment (Risk Pool) ──────────────────────────────
  // Backbone conflict: Sav, odak, aktör kilitlenmesi
  const backboneConflict =
    researchFocus === 100 && mainActors >= 50 && mainClaim === 100;

  if (backboneConflict) {
    if (theoreticalFramework >= 50 && methodology >= 50) {
      return {
        thesisId,
        bucket: "RISK",
        primaryBadge: "CRITICAL_OVERLAP",
        badges: ["CRITICAL_OVERLAP"],
        analysisNote,
      };
    } else {
      // (theoreticalFramework === 0 || methodology === 0)
      return {
        thesisId,
        bucket: "RISK",
        primaryBadge: "APPROACH_DIVERGENCE",
        badges: ["APPROACH_DIVERGENCE"],
        analysisNote,
      };
    }
  }

  // ── STAGE 3: Value Analysis (Contribution Pool) ─────────────────────────
  let primaryBadge: AnalysisBadge;

  if (mainClaim === 50 && researchFocus >= 50) {
    primaryBadge = "DIALECTICAL_OPPORTUNITY";
  } else if (researchFocus === 100 && temporalScope.score === 100) {
    primaryBadge = "THEMATIC_SYNTHESIS";
  } else {
    primaryBadge = "LITERATURE_BRIDGE";
  }

  return {
    thesisId,
    bucket: "CONTRIBUTION",
    primaryBadge,
    badges: [primaryBadge],
    analysisNote,
  };
}

// ============================================================================
// calculateRelationships — Deterministic Engine + Global Badge
// ============================================================================

/**
 * Applies the deterministic decision engine to each LLM-scored item,
 * filters out IRRELEVANT theses, merges with thesis details, and computes
 * the global relationship badge.
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
      analysisNote: decision.analysisNote,
    });
  }

  let globalBadge: RelationshipBadge = "UNRELATED";
  const riskItems = items.filter((i) => i.bucket === "RISK");
  const contributionItems = items.filter((i) => i.bucket === "CONTRIBUTION");

  if (riskItems.length > 0) {
    const hasTwin = riskItems.some(
      (i) => i.primaryBadge === "CRITICAL_OVERLAP",
    );
    const hasSalvageable = riskItems.some(
      (i) => i.primaryBadge === "APPROACH_DIVERGENCE",
    );
    if (hasTwin) {
      globalBadge = "HIGH_RISK";
    } else if (hasSalvageable) {
      globalBadge = "SALVAGEABLE";
    }
  } else if (contributionItems.length > 0) {
    globalBadge = "CONTRIBUTION";
  }

  return {
    globalRelationshipBadge: globalBadge,
    comparisonTable: items,
  };
}
