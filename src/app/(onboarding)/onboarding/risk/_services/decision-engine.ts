import type { Logger } from "@/lib/logger";
import type { EliminationStage } from "@/db/schema";
import type {
  AcademicBadge,
  RelationshipBadge,
  TezaraThesisDetails,
  ThesisBucket,
} from "@/lib/types";
import type { QualitativeAuditItem } from "./analysis";

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
  isRelevant: boolean;
  relevanceExplanation: string;
  originalityStatus: AcademicBadge;
  uniquenessGap: string;
  literatureIntegration: string;
  isEliminated: boolean;
  eliminationStage?: EliminationStage | null;
}

export interface CalculatedRelationshipsResult {
  globalRelationshipBadge: RelationshipBadge;
  comparisonTable: CalculatedComparisonItem[];
}

export function calculateRelationships(
  auditResults: QualitativeAuditItem[],
  validDetails: TezaraThesisDetails[],
  logger?: Logger,
): CalculatedRelationshipsResult {
  if (validDetails.length === 0 || auditResults.length === 0) {
    return {
      globalRelationshipBadge: "UNRELATED",
      comparisonTable: [],
    };
  }

  const detailsMap = new Map<number, TezaraThesisDetails>(
    validDetails.map((d) => [d.id, d]),
  );
  const items: CalculatedComparisonItem[] = [];

  for (const auditItem of auditResults) {
    const detail = detailsMap.get(auditItem.thesisId);
    if (!detail) {
      logger?.warn("originality_hallucinated_id_filtered", {
        service: "originality",
        data: {
          context: "calculateRelationships",
          hallucinatedId: auditItem.thesisId,
        },
      });
      continue;
    }

    let bucket: ThesisBucket = "IRRELEVANT";
    let isEliminated = false;
    let eliminationStage: EliminationStage | null = null;

    if (
      auditItem.originalityStatus === "HIGH_RISK_REPLICATION" ||
      auditItem.originalityStatus === "RELATED_THESIS"
    ) {
      // Ana karşılaştırma tablosuna giden birincil rakipler
      bucket = "PRIMARY_COMPETITOR";
      isEliminated = false;
    } else if (auditItem.originalityStatus === "REFERENCE_MATERIAL") {
      // Dipnot / Arka plan kaynakları (Ana tabloyu şişirmez, kısa rehberiyle kalır)
      bucket = "BACKGROUND_REFERENCE";
      isEliminated = false;
    } else {
      // OUT_OF_SCOPE - Kapsam dışı elenenler
      bucket = "IRRELEVANT";
      isEliminated = true;
      eliminationStage = "ANALYSIS";
    }

    items.push({
      id: detail.id,
      title: detail.title,
      author: detail.author,
      university: detail.university,
      year: detail.year,
      thesisType: detail.thesisType,
      department: detail.department,
      yokPdfUrl: detail.yokPdfUrl || undefined,
      abstract: detail.abstract || undefined,
      bucket,
      isRelevant: auditItem.isRelevant,
      relevanceExplanation: auditItem.relevanceExplanation,
      originalityStatus: auditItem.originalityStatus,
      uniquenessGap: auditItem.uniquenessGap,
      literatureIntegration: auditItem.literatureIntegration,
      isEliminated,
      eliminationStage,
    });
  }

  let globalBadge: RelationshipBadge = "UNRELATED";
  const primaryCompetitors = items.filter(
    (i) => i.bucket === "PRIMARY_COMPETITOR",
  );
  const hasHighRisk = primaryCompetitors.some(
    (i) => i.originalityStatus === "HIGH_RISK_REPLICATION",
  );

  if (hasHighRisk) {
    globalBadge = "HIGH_RISK";
  } else if (items.some((i) => !i.isEliminated)) {
    globalBadge = "CONTRIBUTION_READY";
  }

  return {
    globalRelationshipBadge: globalBadge,
    comparisonTable: items,
  };
}
