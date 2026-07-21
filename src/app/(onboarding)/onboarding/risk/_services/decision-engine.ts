import type { Logger } from "@/lib/logger";
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
  replicationWarning: string;
  literatureReviewUsage: string;
  chapterIntegration: string;
  conceptualBorrowing: string;
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
    if (auditItem.isRelevant) {
      if (auditItem.originalityStatus === "HIGH_RISK_REPLICATION") {
        bucket = "RISK";
      } else {
        bucket = "CONTRIBUTION";
      }
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
      replicationWarning: auditItem.replicationWarning,
      literatureReviewUsage: auditItem.literatureReviewUsage,
      chapterIntegration: auditItem.chapterIntegration,
      conceptualBorrowing: auditItem.conceptualBorrowing,
    });
  }

  let globalBadge: RelationshipBadge = "UNRELATED";
  const activeItems = items.filter((i) => i.isRelevant);
  const riskItems = activeItems.filter((i) => i.bucket === "RISK");
  const contributionItems = activeItems.filter(
    (i) => i.bucket === "CONTRIBUTION",
  );

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
