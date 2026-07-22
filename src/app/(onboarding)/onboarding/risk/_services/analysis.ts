import { generateStructuredContent } from "@/lib/services/gemini";
import { generateCerebrasStructuredContent } from "@/lib/services/cerebras";
import { FLASH_LITE_31, GEMINI_SEED } from "@/lib/constants";
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
  literatureIntegration: string;
}

export const qualitativeAuditItemZodSchema = z.object({
  thesisId: z.number(),
  isRelevant: z.boolean(),
  relevanceExplanation: z.string(),
  originalityStatus: z.enum([
    "HIGH_RISK_REPLICATION",
    "RELATED_THESIS",
    "REFERENCE_MATERIAL",
    "OUT_OF_SCOPE",
  ]),
  uniquenessGap: z.string(),
  literatureIntegration: z.string(),
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
    // Maintain Cohere rerank rank order so batching is stable
    const orderedTheses = [...params.selectedTheses];

    const userThesis = {
      researchCore: params.researchCore,
      targetActors: params.targetActors,
      context: params.context,
      framework: params.framework,
      mainClaim: params.mainClaim,
    };

    // 1. Run ingestion on candidate theses to extract their 6-dimension matrices via Cerebras Gemma 4 31B (batched to respect token quotas)
    log.info("originality_ingestion_start", {
      service: "originality",
      data: { count: orderedTheses.length },
    });
    const ingestionStart = performance.now();

    const ingestionSystemInstruction = buildIngestionSystemInstruction();
    const formattedTheses = orderedTheses.map((t) => ({
      id: t.id,
      title: t.title,
      author: t.author,
      abstract: t.abstract || "",
    }));

    type IngestionExtractedItem = {
      id: number;
      researchCore: string;
      spatialContext: string;
      temporalContext: string;
      theoreticalFramework: string;
      methodology: string;
      mainClaim: string;
    };

    const INGESTION_BATCH_SIZE = 12;
    const ingestionBatches: (typeof formattedTheses)[] = [];
    for (let i = 0; i < formattedTheses.length; i += INGESTION_BATCH_SIZE) {
      ingestionBatches.push(formattedTheses.slice(i, i + INGESTION_BATCH_SIZE));
    }

    const allIngestedTheses: IngestionExtractedItem[] = [];

    for (let bIndex = 0; bIndex < ingestionBatches.length; bIndex++) {
      const batch = ingestionBatches[bIndex];
      const cerebrasPrompt = buildIngestionPrompt(batch);

      try {
        const cerebrasResponse = await generateCerebrasStructuredContent<{
          theses: IngestionExtractedItem[];
        }>(
          ingestionSystemInstruction,
          cerebrasPrompt,
          ingestionResponseSchema,
          log,
          {
            payloadStage: `originality_candidate_ingestion_batch_${bIndex + 1}`,
          },
        );

        if (cerebrasResponse?.theses) {
          allIngestedTheses.push(...cerebrasResponse.theses);
        }
      } catch (ingestErr) {
        log.warn("cerebras_ingestion_batch_fallback", {
          service: "originality",
          error: ingestErr,
          data: { batchIndex: bIndex + 1 },
        });
        // Graceful fallback for batch items if Cerebras hits 429 quota or network error
        batch.forEach((item) => {
          allIngestedTheses.push({
            id: item.id,
            researchCore: item.abstract.slice(0, 400),
            spatialContext: "Belirtilmemiş",
            temporalContext: "Belirtilmemiş",
            theoreticalFramework: "Belirtilmemiş",
            methodology: "Belirtilmemiş",
            mainClaim: item.abstract.slice(0, 400),
          });
        });
      }
    }

    const ingestionDuration = performance.now() - ingestionStart;

    log.info("originality_ingestion_success", {
      service: "originality",
      durationMs: ingestionDuration,
      data: {
        count: allIngestedTheses.length,
        provider: "cerebras",
      },
    });

    // Map candidate theses to IngestedThesisCandidate format
    const ingestedCandidates: IngestedThesisCandidate[] = orderedTheses.map(
      (t) => {
        const matched = allIngestedTheses.find((it) => it.id === t.id);
        return {
          id: t.id,
          title: t.title,
          matrix: {
            researchCore: matched?.researchCore || t.abstract.slice(0, 400),
            spatialContext: matched?.spatialContext || "Belirtilmemiş",
            temporalContext: matched?.temporalContext || "Belirtilmemiş",
            theoreticalFramework:
              matched?.theoreticalFramework || "Belirtilmemiş",
            methodology: matched?.methodology || "Belirtilmemiş",
            mainClaim: matched?.mainClaim || t.abstract.slice(0, 400),
          },
        };
      },
    );

    // 2. Run originality audit (batch LLM comparison + validation)
    const BATCH_SIZE = 4;
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
        FLASH_LITE_31,
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
    for (const thesis of orderedTheses) {
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
        validatedIds: orderedTheses.length,
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
