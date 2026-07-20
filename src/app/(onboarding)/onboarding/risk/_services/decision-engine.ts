import type { Logger } from "@/lib/logger";
import type {
  AcademicBadge,
  RelationshipBadge,
  TezaraThesisDetails,
  ThesisBucket,
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
  researchCore: number;
  spatialContext: number;
  temporalLabel: string;
  theoreticalFramework: number;
  methodology: number;
  mainClaim: number;
}

export interface CalculatedRelationshipsResult {
  globalRelationshipBadge: RelationshipBadge;
  comparisonTable: CalculatedComparisonItem[];
}

function getAcademicBadge(item: LLMScoredItem): AcademicBadge {
  // 1. Yöntemsel Şablon / Metot Referansı
  if (item.methodology === 100) {
    return "METHODOLOGY_REFERENCE";
  }

  // 2. Kuramsal Temel / Teori Referansı
  if (item.theoreticalFramework === 100) {
    return "THEORETICAL_ANCHOR";
  }

  // 3. Tarihsel Derinlik / Kronolojik Referans
  if (item.temporalLabel === "PAST" && item.researchCore >= 50) {
    return "HISTORICAL_CONTEXT";
  }

  // 4. Gelecek Projeksiyonu / Ardıl Çalışma
  if (item.temporalLabel === "FUTURE" && item.researchCore >= 50) {
    return "FUTURE_PROJECTION";
  }

  // 5. Bağlam Kıyası / Farklı Bağlamda Aynı Odak
  if (item.spatialContext === 0 && item.researchCore === 100) {
    return "CONTEXTUAL_COMPARISON";
  }

  // 6. Bulgusal Kıyas / Tartışma Ortağı
  if (item.researchCore >= 50) {
    return "EMPIRICAL_BENCHMARK";
  }

  // 7. Genel Literatür / Arka Plan Dolgusu (Varsayılan)
  return "BACKGROUND_LITERATURE";
}

export function applyDecisionEngine(item: LLMScoredItem): DecisionResult {
  const {
    researchCore,
    spatialContext,
    temporalLabel,
    theoreticalFramework,
    methodology,
    mainClaim,
    tez_id,
  } = item;
  const thesisId = Number(tez_id);

  // Max 500-point score: RC + SC + TF + ME + MC (TC/temporalLabel excluded)
  // Temporal is a categorical signal kept separate for badge logic.
  const relevanceScore =
    researchCore +
    spatialContext +
    theoreticalFramework +
    methodology +
    mainClaim;

  // ── 4 Ordered Rules ──────────────────────────────────────────
  // Rule 1: RC = 0 → IRRELEVANT
  if (researchCore === 0) {
    return {
      thesisId,
      bucket: "IRRELEVANT",
      primaryBadge: "IRRELEVANT_DATA",
      badges: ["IRRELEVANT_DATA"],
      relevanceScore,
    };
  }

  // Rule 2: RC = 100 & SC = 100 & temporalLabel = OVERLAP & MC = 100 &
  //         (ME = 100 OR TF = 100) → RISK
  const isContextOverlap =
    spatialContext === 100 && temporalLabel === "OVERLAP";
  if (
    researchCore === 100 &&
    isContextOverlap &&
    mainClaim === 100 &&
    (methodology === 100 || theoreticalFramework === 100)
  ) {
    // Twin thesis: all six at 100
    const allMax =
      researchCore === 100 &&
      spatialContext === 100 &&
      theoreticalFramework === 100 &&
      methodology === 100 &&
      mainClaim === 100;
    return {
      thesisId,
      bucket: "RISK",
      primaryBadge: allMax ? "TWIN_THESIS_ALERT" : "CRITICAL_REPLICATION_ALERT",
      badges: [allMax ? "TWIN_THESIS_ALERT" : "CRITICAL_REPLICATION_ALERT"],
      relevanceScore,
    };
  }

  // Rule 4: Everything else → CONTRIBUTION with academic badge
  const primaryBadge = getAcademicBadge(item);

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
      researchCore: llmItem.researchCore,
      spatialContext: llmItem.spatialContext,
      temporalLabel: llmItem.temporalLabel,
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
