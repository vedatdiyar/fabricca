import { z } from "zod";
import { ThinkingLevel } from "@google/genai";
import {
  generateStructuredContent,
  type JsonSchema,
} from "@/lib/services/gemini";
import { FLASH_LITE_35 } from "@/lib/constants";
import { buildPipelineStage2SocraticSystemInstruction } from "@/lib/prompts";
import type { AuditReport, SocraticVerdict } from "./types";

import { loadThesisStructureContext } from "./stage1-audit";

/** Maximum discussion cycles before the pipeline is forced to conclude, preventing infinite looping. */
export const MAX_DISCUSSION_CYCLES = 3;

const socraticVerdictSchema = z.object({
  state: z.enum(["REQUIRES_ANSWER", "COMPLETE"]),
  summary: z.string(),
  readinessScore: z.number().min(0).max(100),
});

const socraticVerdictJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    state: {
      type: "string",
      enum: ["REQUIRES_ANSWER", "COMPLETE"],
      description:
        "REQUIRES_ANSWER when the user's latest answer leaves open critique dimensions that must be resolved through further Socratic dialogue. COMPLETE when the argument is convincingly defended.",
    },
    summary: {
      type: "string",
      description:
        "Turkish summary of the internal evaluation across logic, thesis consistency and counter-arguments.",
    },
    readinessScore: {
      type: "number",
      description:
        "Internal readiness score (0-100) indicating how close the draft is to being convincingly defended.",
    },
  },
  required: ["state", "summary", "readinessScore"],
  additionalProperties: false,
};

/**
 * Runs the internal Socratic evaluation structure on the user's latest elaboration.
 * The evaluation resolves the discussion to either a further critique turn (REQUIRES_ANSWER)
 * or completion (COMPLETE), with a hard cycle cap to prevent infinite looping.
 *
 * @param userId - The ID of the authenticated user.
 * @param originalDraft - The original draft paragraph text that started the pipeline.
 * @param audit - The Stage 1 audit report for the draft.
 * @param elaboration - The user's latest answer to the previous Socratic critique.
 * @param cycle - The current discussion cycle number (1-based).
 * @returns The structured Socratic verdict.
 */
export async function evaluateSocraticDiscussion(
  userId: number,
  originalDraft: string,
  audit: AuditReport,
  elaboration: string,
  cycle: number,
): Promise<SocraticVerdict> {
  const { matrixContext, boxContext } =
    await loadThesisStructureContext(userId);

  const auditContext =
    audit.findings
      .map((finding) => `- [${finding.severity}] ${finding.message}`)
      .join("\n") || audit.summary;

  const maxCyclesNote =
    cycle >= MAX_DISCUSSION_CYCLES
      ? `\nBu tartışmanın son turudur (tur ${MAX_DISCUSSION_CYCLES}). Kalan açık noktaları özetleyip mutlaka "state": "COMPLETE" dön.`
      : "";

  const prompt =
    `Orijinal Taslak Metin:\n"""\n${originalDraft}\n"""\n\n` +
    `Denetim Bulguları:\n${auditContext}\n\n` +
    `Kullanıcının Son Yanıtı:\n"""\n${elaboration}\n"""\n\n` +
    `Mevcut Tartışma Turu: ${cycle}${maxCyclesNote}`;

  return generateStructuredContent<SocraticVerdict>(
    FLASH_LITE_35,
    buildPipelineStage2SocraticSystemInstruction(
      matrixContext,
      boxContext,
      auditContext,
    ),
    prompt,
    socraticVerdictJsonSchema,
    undefined,
    {
      zodSchema: socraticVerdictSchema,
      payloadStage: "advisor_pipeline_stage2_socratic",
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  );
}
