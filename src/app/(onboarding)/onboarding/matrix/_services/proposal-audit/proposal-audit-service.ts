import { z } from "zod";
import { generateGeminiStructuredContent } from "@/core/services/ai";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import { ThinkingLevel } from "@google/genai";
import { PipelineRun } from "@/lib/pipeline-logger";
import { PROPOSAL_AUDIT_PIPELINE } from "@/lib/pipeline-definitions";
import {
  auditOutputSchema,
  auditOutputJsonSchema,
  type ProposalAuditResult,
} from "./schemas";
import { AUDIT_SYSTEM_INSTRUCTION } from "./prompts";
import { decomposeProposalToQueries } from "./query-decomposer";
import { runDiscoverySearches } from "./discovery";
import { buildSearchChips, buildEvidenceSummary } from "./evidence-builder";

/**
 * Runs multi-angle grounded search and produces a deep academic diagnostic audit.
 *
 * @param proposalText - The raw thesis proposal or outline provided by the user.
 * @returns The complete audit result with chips, critique, and questions.
 */
export async function auditThesisProposal(
  proposalText: string,
): Promise<ProposalAuditResult> {
  const run = PipelineRun.create(PROPOSAL_AUDIT_PIPELINE);

  const queries = await run.execute(
    "decompose",
    () => decomposeProposalToQueries(proposalText, run.logger),
    { description: "Gemini Flash" },
  );

  const discovery = await run.execute("discovery", () =>
    runDiscoverySearches(queries, run, run.logger),
  );

  const searchChips = buildSearchChips(queries, discovery);
  const evidenceSummary = buildEvidenceSummary(queries, discovery);

  const auditPrompt = `<proposal>
${proposalText.slice(0, 10000)}
</proposal>

<search_evidence>
${evidenceSummary}
</search_evidence>

Yukarıdaki tez önerisini ve taranan kanıtları inceleyerek güçlü yönleri ve teşhisi belirle; yalnızca gerekliyse (kapsam/odak daraltması gerekiyorsa) en fazla 2 netleştirme sorusu üret, metin yeterince netse questions dizisini boş [] bırak.`;

  const auditResponse = await run.execute(
    "critique",
    () =>
      generateGeminiStructuredContent<z.infer<typeof auditOutputSchema>>(
        FLASH_LITE_35,
        AUDIT_SYSTEM_INSTRUCTION,
        auditPrompt,
        auditOutputJsonSchema,
        run.logger,
        {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          zodSchema: auditOutputSchema,
          seed: GEMINI_SEED,
          payloadStage: "proposal_audit_critique",
          quiet: true,
        },
      ),
    { description: "Gemini Flash" },
  );

  run.finish();

  return {
    searchChips,
    evidenceSummary,
    strengths: auditResponse.strengths,
    diagnosticCritique: auditResponse.diagnosticCritique,
    questions: auditResponse.questions,
  };
}
