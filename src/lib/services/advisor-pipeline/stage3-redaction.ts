import { z } from "zod";
import { ThinkingLevel } from "@google/genai";
import {
  generateStructuredContent,
  type JsonSchema,
} from "@/lib/services/gemini";
import { FLASH_LITE_35 } from "@/lib/constants";
import { buildPipelineStage3RedactionSystemInstruction } from "@/lib/prompts";
import type { AuditReport, PipelineDiff } from "./types";

const redactionSchema = z.object({
  polishedText: z.string(),
});

const redactionJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    polishedText: {
      type: "string",
      description:
        "The fully polished English text preserving the core meaning with APA 7 citations applied.",
    },
  },
  required: ["polishedText"],
  additionalProperties: false,
};

/**
 * Runs Stage 3 of the academic pipeline: polishes the user's English draft for grammar,
 * academic style and APA 7 without rewriting heavily, then packages it for the diff view.
 *
 * @param originalDraft - The user's original English draft paragraph.
 * @param audit - The Stage 1 audit report whose flagged corrections must be applied.
 * @returns The side-by-side diff payload (original and polished text).
 */
export async function runStage3Redaction(
  originalDraft: string,
  audit: AuditReport,
): Promise<PipelineDiff> {
  const auditContext =
    audit.findings
      .map((finding) => `- [${finding.severity}] ${finding.message}`)
      .join("\n") || audit.summary;

  const result = await generateStructuredContent<{ polishedText: string }>(
    FLASH_LITE_35,
    buildPipelineStage3RedactionSystemInstruction(auditContext),
    `Cilalanacak Orijinal İngilizce Metin:\n"""\n${originalDraft}\n"""`,
    redactionJsonSchema,
    undefined,
    {
      zodSchema: redactionSchema,
      payloadStage: "advisor_pipeline_stage3_redaction",
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  );

  return { original: originalDraft, polished: result.polishedText };
}
