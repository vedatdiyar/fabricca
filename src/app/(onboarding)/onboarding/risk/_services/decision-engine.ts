import type { Logger } from "@/lib/logger";
import type {
  AcademicBadge,
  RelationshipBadge,
  TezaraThesisDetails,
  ThesisBucket,
  DimensionLevel,
  DimensionScores,
  TemporalScopeLabel,
} from "@/lib/types";
import type { LLMScoredItem } from "./analysis";

export interface DecisionResult {
  thesisId: number;
  bucket: ThesisBucket;
  primaryBadge: AcademicBadge;
  badges: AcademicBadge[];
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
  primaryBadge: AcademicBadge;
  badges: AcademicBadge[];
  relevanceScore: number;
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

function computeDimensionLevel(score: number): DimensionLevel {
  if (score >= 150) return "HIGH";
  if (score === 100) return "MEDIUM";
  return "LOW";
}

function computeDimensionScores(params: {
  researchFocus: number;
  mainClaim: number;
  methodology: number;
  theoreticalFramework: number;
  spatialScope: number;
  mainActors: number;
}): DimensionScores {
  const content = params.researchFocus + params.mainClaim;
  const methodTheory = params.methodology + params.theoreticalFramework;
  const context = params.spatialScope + params.mainActors;

  return {
    content: computeDimensionLevel(content),
    methodTheory: computeDimensionLevel(methodTheory),
    context: computeDimensionLevel(context),
  };
}

function getAcademicBadge(
  scores: DimensionScores,
  temporalLabel: TemporalScopeLabel,
): AcademicBadge {
  const { content, methodTheory, context } = scores;

  if (content === "LOW" && methodTheory === "LOW" && context === "LOW")
    return "INDEPENDENT_CONCEPTUAL_STUDY";
  if (content === "LOW" && methodTheory === "LOW" && context === "MEDIUM")
    return "INNOVATIVE_EXPLORATION";
  if (content === "LOW" && methodTheory === "MEDIUM" && context === "LOW")
    return "HORIZON_EXPANSION";
  if (content === "MEDIUM" && methodTheory === "LOW" && context === "LOW")
    return "METHODOLOGICAL_REVOLUTION";
  if (content === "MEDIUM" && methodTheory === "MEDIUM" && context === "LOW")
    return "GEOGRAPHIC_REPRESENTATION";
  if (content === "MEDIUM" && methodTheory === "LOW" && context === "MEDIUM")
    return "METHOD_DRIVEN_ANALYSIS";
  if (content === "LOW" && methodTheory === "MEDIUM" && context === "MEDIUM")
    return "THEMATIC_INITIATIVE";
  if (content === "MEDIUM" && methodTheory === "MEDIUM" && context === "MEDIUM")
    return "BALANCED_SCHOLARLY_CONTRIBUTION";

  if (content === "LOW" && methodTheory === "HIGH" && context === "LOW")
    return "EMPIRICAL_ADAPTATION";
  if (content === "MEDIUM" && methodTheory === "HIGH" && context === "LOW")
    return "CONTEXTUAL_MODEL_TRANSFER";
  if (content === "LOW" && methodTheory === "HIGH" && context === "MEDIUM")
    return "CONCEPTUAL_MODEL_TRANSFER";

  if (content === "HIGH" && methodTheory === "LOW" && context === "LOW")
    return "METHODOLOGICAL_INNOVATION";
  if (content === "HIGH" && methodTheory === "LOW" && context === "MEDIUM")
    return "METHODOLOGICAL_RECONSTRUCTION";
  if (content === "MEDIUM" && methodTheory === "LOW" && context === "HIGH")
    return "THEORETICAL_RECONSTRUCT";
  if (content === "HIGH" && methodTheory === "LOW" && context === "HIGH")
    return "METHODOLOGICAL_CONTRAST";

  if (content === "LOW" && methodTheory === "MEDIUM" && context === "HIGH")
    return "DIALECTICAL_CONTRIBUTION";
  if (content === "LOW" && methodTheory === "HIGH" && context === "HIGH")
    return "PARADIGM_CHALLENGE";
  if (content === "MEDIUM" && methodTheory === "MEDIUM" && context === "HIGH")
    return "THEMATIC_EXPANSION";
  if (content === "MEDIUM" && methodTheory === "HIGH" && context === "HIGH")
    return "INCREMENTAL_CLAIM_CONTRIBUTION";

  if (content === "HIGH" && methodTheory === "MEDIUM" && context === "LOW")
    return "SPATIAL_REPLICATION";
  if (content === "HIGH" && methodTheory === "HIGH" && context === "LOW")
    return "LOCAL_VALIDATION_STUDY";
  if (content === "HIGH" && methodTheory === "MEDIUM" && context === "MEDIUM")
    return "HIGH_LITERATURE_PARALLELISM";
  if (content === "HIGH" && methodTheory === "HIGH" && context === "MEDIUM")
    return "NARROW_SCOPE_REPLICATION";

  if (
    content === "MEDIUM" &&
    methodTheory === "HIGH" &&
    context === "MEDIUM" &&
    temporalLabel === "FUTURE"
  )
    return "TEMPORAL_FOLLOW_UP";

  if (content === "HIGH" && methodTheory === "MEDIUM" && context === "HIGH")
    return "BORDERLINE_SIMILARITY_ALERT";
  if (content === "HIGH" && methodTheory === "HIGH" && context === "HIGH")
    return "TEMPORAL_UPDATE_STUDY";

  return "BALANCED_SCHOLARLY_CONTRIBUTION";
}

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

  const isTemporalOverlap =
    temporalScope.score === 100 && temporalScope.label === "OVERLAP";

  if (mainClaim === 0 && (researchFocus === 0 || mainActors === 0)) {
    return {
      thesisId,
      bucket: "IRRELEVANT",
      primaryBadge: "IRRELEVANT_DATA",
      badges: ["IRRELEVANT_DATA"],
      relevanceScore,
    };
  }

  if (
    researchFocus === 100 &&
    mainActors === 100 &&
    isTemporalOverlap &&
    spatialScope === 100 &&
    theoreticalFramework === 100 &&
    methodology === 100 &&
    mainClaim === 100
  ) {
    return {
      thesisId,
      bucket: "RISK",
      primaryBadge: "TWIN_THESIS_ALERT",
      badges: ["TWIN_THESIS_ALERT"],
      relevanceScore,
    };
  }

  if (
    researchFocus === 100 &&
    mainActors === 100 &&
    isTemporalOverlap &&
    spatialScope === 100 &&
    mainClaim === 100 &&
    (methodology === 50 || methodology === 100) &&
    (theoreticalFramework === 50 || theoreticalFramework === 100)
  ) {
    return {
      thesisId,
      bucket: "RISK",
      primaryBadge: "CRITICAL_REPLICATION_ALERT",
      badges: ["CRITICAL_REPLICATION_ALERT"],
      relevanceScore,
    };
  }

  const dimScores = computeDimensionScores({
    researchFocus,
    mainClaim,
    methodology,
    theoreticalFramework,
    spatialScope,
    mainActors,
  });

  const primaryBadge = getAcademicBadge(dimScores, temporalScope.label);

  return {
    thesisId,
    bucket: "CONTRIBUTION",
    primaryBadge,
    badges: [primaryBadge],
    relevanceScore,
  };
}

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
