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

function getAcademicBadge(
  item: LLMScoredItem,
  bucket: ThesisBucket,
): AcademicBadge {
  if (bucket === "RISK") {
    // Twin or Critical Replication is already handled in applyDecisionEngine,
    // but we support it as a safeguard.
    return item.researchFocus === 100 &&
      item.mainActors === 100 &&
      item.temporalScope.score === 100 &&
      item.temporalScope.label === "OVERLAP" &&
      item.spatialScope === 100 &&
      item.theoreticalFramework === 100 &&
      item.methodology === 100 &&
      item.mainClaim === 100
      ? "TWIN_THESIS_ALERT"
      : "CRITICAL_REPLICATION_ALERT";
  }

  // 1. Yöntemsel Şablon / Metot Referansı
  if (item.methodology === 100) {
    return "METHODOLOGY_REFERENCE";
  }

  // 2. Kuramsal Temel / Teori Referansı
  if (item.theoreticalFramework === 100) {
    return "THEORETICAL_ANCHOR";
  }

  // 3. Tarihsel Derinlik / Kronolojik Referans
  if (
    item.temporalScope.label === "PAST" &&
    (item.researchFocus >= 50 || item.mainActors >= 50)
  ) {
    return "HISTORICAL_CONTEXT";
  }

  // 4. Gelecek Projeksiyonu / Ardıl Çalışma
  if (
    item.temporalScope.label === "FUTURE" &&
    (item.researchFocus >= 50 || item.mainActors >= 50)
  ) {
    return "FUTURE_PROJECTION";
  }

  // 5. Mekânsal Kıyas / Bağlam Transferi
  if (item.spatialScope === 0 && item.researchFocus === 100) {
    return "CONTEXTUAL_COMPARISON";
  }

  // 6. Bulgusal Kıyas / Tartışma Ortağı
  if (item.researchFocus >= 50 || item.mainActors >= 50) {
    return "EMPIRICAL_BENCHMARK";
  }

  // 7. Genel Literatür / Arka Plan Dolgusu (Varsayılan)
  return "BACKGROUND_LITERATURE";
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
    const isComplementaryPair =
      (researchFocus === 0 && mainActors === 100) ||
      (researchFocus === 100 && mainActors === 0);
    if (!isComplementaryPair) {
      return {
        thesisId,
        bucket: "IRRELEVANT",
        primaryBadge: "IRRELEVANT_DATA",
        badges: ["IRRELEVANT_DATA"],
        relevanceScore,
      };
    }
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

  const primaryBadge = getAcademicBadge(item, "CONTRIBUTION");

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
