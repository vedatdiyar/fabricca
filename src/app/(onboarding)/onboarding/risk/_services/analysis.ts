import { generateStructuredContent } from "@/lib/services/gemini";
import { GEMINI_MODEL, GEMINI_SEED } from "@/lib/constants";
import { ThinkingLevel } from "@google/genai";
import { z } from "zod";
import type { Logger } from "@/lib/logger";
import type { TezaraThesisDetails, AcademicBadge } from "@/lib/types";
import {
  buildQualitativeSystemInstruction,
  buildQualitativePrompt,
  qualitativeAnalysisJsonSchema,
  type IngestedThesisCandidate,
} from "@/lib/prompts/originality-analysis";
import {
  buildIngestionSystemInstruction,
  buildIngestionPrompt,
  ingestionResponseSchema,
} from "@/lib/prompts/ingestion";

export interface QualitativeAuditItem {
  thesisId: number;
  isRelevant: boolean;
  relevanceExplanation: string;
  originalityStatus: AcademicBadge;
  uniquenessGap: string;
  replicationWarning: string;
  literatureReviewUsage: string;
  chapterIntegration: string;
  conceptualBorrowing: string;
}

const qualitativeAuditItemZodSchema = z.object({
  thesisId: z.number(),
  isRelevant: z.boolean(),
  relevanceExplanation: z.string(),
  originalityStatus: z.enum([
    "HIGH_RISK_REPLICATION",
    "RELATED_THESIS",
    "HISTORICAL_BACKGROUND",
    "METHODOLOGICAL_BENCHMARK",
    "OUT_OF_SCOPE",
  ]),
  uniquenessGap: z.string(),
  replicationWarning: z.string(),
  literatureReviewUsage: z.string(),
  chapterIntegration: z.string(),
  conceptualBorrowing: z.string(),
});

export const qualitativeBatchResponseZodSchema = z.array(
  qualitativeAuditItemZodSchema,
);

export type AnalyzeOriginalityRiskParams = {
  researchCore: string;
  targetActors: string;
  context: string;
  framework: string;
  mainClaim: string;
  selectedTheses: TezaraThesisDetails[];
};

export async function analyzeOriginalityRisk(
  params: AnalyzeOriginalityRiskParams,
  log: Logger,
): Promise<{ auditResults: QualitativeAuditItem[] }> {
  try {
    const sortedTheses = [...params.selectedTheses].sort((a, b) => a.id - b.id);

    const userThesis = {
      researchCore: params.researchCore,
      targetActors: params.targetActors,
      context: params.context,
      framework: params.framework,
      mainClaim: params.mainClaim,
    };

    // 1. Run ingestion on candidate theses to extract their 6-dimension matrices (Parallel LOW batches of 5)
    log.info("originality_ingestion_start", {
      service: "originality",
      data: { count: sortedTheses.length },
    });
    const ingestionStart = performance.now();

    const ingestionSystemInstruction = buildIngestionSystemInstruction();
    const formattedTheses = sortedTheses.map((t) => ({
      id: t.id,
      title: t.title,
      author: t.author,
      abstract: t.abstract || "",
    }));

    const INGESTION_BATCH_SIZE = 5;
    const thesisBatches: (typeof formattedTheses)[] = [];
    for (let i = 0; i < formattedTheses.length; i += INGESTION_BATCH_SIZE) {
      thesisBatches.push(formattedTheses.slice(i, i + INGESTION_BATCH_SIZE));
    }

    type IngestionExtractedItem = {
      id: number;
      researchCore: string;
      spatialContext: string;
      temporalContext: string;
      theoreticalFramework: string;
      methodology: string;
      mainClaim: string;
    };

    const ingestionBatchPromises = thesisBatches.map((batch, batchIdx) =>
      generateStructuredContent<{ theses: IngestionExtractedItem[] }>(
        GEMINI_MODEL,
        ingestionSystemInstruction,
        buildIngestionPrompt(batch),
        ingestionResponseSchema,
        log,
        {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          seed: GEMINI_SEED,
          payloadStage: `originality_candidate_ingestion_b${batchIdx + 1}`,
          quiet: true,
        },
      ),
    );

    const batchResults = await Promise.all(ingestionBatchPromises);
    const allIngestedTheses = batchResults.flatMap((res) => res.theses);

    const ingestionDuration = performance.now() - ingestionStart;
    log.info("originality_ingestion_success", {
      service: "originality",
      durationMs: ingestionDuration,
      data: {
        count: allIngestedTheses.length,
        batchCount: thesisBatches.length,
      },
    });

    // Map candidate theses to IngestedThesisCandidate format
    const ingestedCandidates: IngestedThesisCandidate[] = sortedTheses.map(
      (t) => {
        const matched = allIngestedTheses.find((it) => it.id === t.id);
        return {
          id: t.id,
          title: t.title,
          matrix: {
            researchCore: matched?.researchCore || "Belirtilmemiş",
            spatialContext: matched?.spatialContext || "Belirtilmemiş",
            temporalContext: matched?.temporalContext || "Belirtilmemiş",
            theoreticalFramework:
              matched?.theoreticalFramework || "Belirtilmemiş",
            methodology: matched?.methodology || "Belirtilmemiş",
            mainClaim: matched?.mainClaim || "Belirtilmemiş",
          },
        };
      },
    );

    // 2. Run originality audit (batch LLM comparison + validation)
    const BATCH_SIZE = 3;
    const chunks: IngestedThesisCandidate[][] = [];
    for (let i = 0; i < ingestedCandidates.length; i += BATCH_SIZE) {
      chunks.push(ingestedCandidates.slice(i, i + BATCH_SIZE));
    }

    log.info("originality_audit_start", {
      service: "originality",
      data: {
        count: ingestedCandidates.length,
        batches: chunks.length,
        summary: `(${ingestedCandidates.length} theses partitioned into ${chunks.length} batches of size ${BATCH_SIZE})`,
      },
    });
    const auditStart = performance.now();

    const systemInstruction = buildQualitativeSystemInstruction();

    // Call all batches concurrently using Promise.all
    const batchPromises = chunks.map(async (chunk, index) => {
      const prompt = buildQualitativePrompt(userThesis, chunk);

      return generateStructuredContent<QualitativeAuditItem[]>(
        GEMINI_MODEL,
        systemInstruction,
        prompt,
        qualitativeAnalysisJsonSchema,
        log,
        {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          seed: GEMINI_SEED,
          zodSchema: qualitativeBatchResponseZodSchema,
          thesisMatrix: params,
          payloadStage: `originality_qualitative_audit_batch_${index + 1}`,
          quiet: true,
        },
      );
    });

    const resultsArray = await Promise.all(batchPromises);
    const auditResults = resultsArray.flat();

    // Validate all thesis IDs are present before declaring success
    const returnedIds = new Set(auditResults.map((r) => r.thesisId));
    for (const thesis of sortedTheses) {
      if (!returnedIds.has(thesis.id)) {
        log.error("originality_missing_thesis_id_corruption", {
          service: "originality",
          data: {
            thesisId: thesis.id,
          },
        });
        throw new Error(
          `Classification payload corruption: Model omitted thesis ID ${thesis.id} from the qualitative response.`,
        );
      }
    }

    const auditDuration = performance.now() - auditStart;
    log.info("originality_audit_success", {
      service: "originality",
      durationMs: auditDuration,
      data: {
        validatedIds: sortedTheses.length,
        resultCount: auditResults.length,
        ingestionDurationMs: ingestionDuration,
      },
    });

    return { auditResults };
  } catch (err) {
    log.error("originality_audit_failed", {
      service: "originality",
      error: err,
      data: { context: params.researchCore },
    });
    throw err;
  }
}
