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
    "SAFE_ORIGINAL",
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
  log.file("analysis.ts");
  const startTime = performance.now();
  log.groupStart("originality_risk_analyze");

  try {
    const sortedTheses = [...params.selectedTheses].sort((a, b) => a.id - b.id);

    const userThesis = {
      researchCore: params.researchCore,
      targetActors: params.targetActors,
      context: params.context,
      framework: params.framework,
      mainClaim: params.mainClaim,
    };

    // 1. Run ingestion on all candidate theses to extract their 6-dimension matrices
    log.info("originality_ingestion_start", {
      service: "originality",
      data: { count: sortedTheses.length },
    });
    const ingestionStart = performance.now();

    const ingestionSystemInstruction = buildIngestionSystemInstruction();
    const ingestionPrompt = buildIngestionPrompt(
      sortedTheses.map((t) => ({
        id: t.id,
        title: t.title,
        author: t.author,
        abstract: t.abstract || "",
      })),
    );

    const ingestionResult = await generateStructuredContent<{
      theses: {
        id: number;
        researchCore: string;
        spatialContext: string;
        temporalContext: string;
        theoreticalFramework: string;
        methodology: string;
        mainClaim: string;
      }[];
    }>(
      GEMINI_MODEL,
      ingestionSystemInstruction,
      ingestionPrompt,
      ingestionResponseSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        seed: GEMINI_SEED,
        payloadStage: "originality_candidate_ingestion",
        quiet: true,
      },
    );

    const ingestionDuration = performance.now() - ingestionStart;
    log.info("originality_ingestion_success", {
      service: "originality",
      durationMs: ingestionDuration,
    });

    // Map candidate theses to IngestedThesisCandidate format
    const ingestedCandidates: IngestedThesisCandidate[] = sortedTheses.map(
      (t) => {
        const matched = ingestionResult.theses.find((it) => it.id === t.id);
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

    const totalDuration = performance.now() - startTime;
    log.groupEnd("originality_risk_analyze", totalDuration);

    return { auditResults };
  } catch (err) {
    const durationMs = performance.now() - startTime;
    log.error("originality_risk_analyze_failed", {
      service: "originality",
      error: err,
      durationMs,
      data: { context: params.researchCore },
    });
    log.groupEnd("originality_risk_analyze", durationMs);
    throw err;
  }
}
