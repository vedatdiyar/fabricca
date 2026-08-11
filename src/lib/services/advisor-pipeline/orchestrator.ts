import { getAi } from "@/lib/services/gemini";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import { buildPipelineStage2SocraticSystemInstruction } from "@/lib/prompts";
import {
  ADVISOR_TOOL_DECLARATIONS,
  isReadTool,
  executeReadTool,
  getToolPreviousState,
} from "@/lib/services/advisor-tools";
import { formatToolExplanation } from "@/lib/services/advisor-tools/format-tool";

import { runStage1Audit, loadThesisStructureContext } from "./stage1-audit";
import { evaluateSocraticDiscussion } from "./stage2-socratic";
import { runStage3Redaction } from "./stage3-redaction";
import type { PipelineResult, SocraticVerdict } from "./types";
import type { RagSearchResultItem } from "@/lib/services/rag-search";

/** SSE event emission and text streaming interface used by the pipeline orchestrator. */
export interface PipelineSseWriter {
  send(type: string, payload: Record<string, unknown>): void;
  delta(text: string): void;
}

/** Inputs driving a single pipeline turn. */
export interface PipelineTurnInput {
  userId: number;
  query: string;
  originalDraft: string;
  /** When true, this turn is a continuation answering the previous Socratic critique. */
  isContinuation: boolean;
  /** 1-based discussion cycle to run during this turn. */
  cycle: number;
  history: Array<{ role: string; content: string }>;
}

/** Output produced by a full pipeline turn. */
export interface PipelineTurnOutput {
  text: string;
  sources: RagSearchResultItem[];
  pipeline: PipelineResult;
}

/**
 * Assembles the Gemini conversation contents for the Socratic streaming turn.
 *
 * @param input - The pipeline turn input.
 * @param history - The trimmed chat history.
 * @returns Gemini contents array including the draft and latest elaboration.
 */
function buildSocraticContents(
  input: PipelineTurnInput,
  history: Array<{ role: string; content: string }>,
): Array<Record<string, unknown>> {
  const contents: Array<Record<string, unknown>> = [];
  for (const msg of history.slice(-6)) {
    contents.push({ role: msg.role, parts: [{ text: msg.content }] });
  }

  const promptSection = input.isContinuation
    ? `Orijinal Taslak Metni:\n"""\n${input.originalDraft}\n"""\n\nKullanıcının Önceki Sokratik Sorulara Yanıtı:\n"""\n${input.query}\n"""`
    : `Öğrencinin Taslak Metni (tartışılacak ve eleştirilecek paragraf):\n"""\n${input.originalDraft}\n"""`;

  contents.push({ role: "user", parts: [{ text: promptSection }] });
  return contents;
}

/**
 * Streams the Turkish Socratic critique turn over SSE, handling read-tool loops
 * inline and emitting mutation tool confirmation events for the UI card.
 *
 * @param writer - The SSE writer used to stream deltas and tool call requests.
 * @param input - The pipeline turn input.
 * @returns The accumulated critique text.
 */
async function streamSocraticTurn(
  writer: PipelineSseWriter,
  input: PipelineTurnInput,
  auditSummary: string,
  history: Array<{ role: string; content: string }>,
): Promise<string> {
  const { matrixContext, boxContext } = await loadThesisStructureContext(
    input.userId,
  );
  const systemInstruction = buildPipelineStage2SocraticSystemInstruction(
    matrixContext,
    boxContext,
    auditSummary,
  );

  const contents = buildSocraticContents(input, history);
  const ai = getAi();

  let fullText = "";
  let maxTurns = 4;
  let continueLoop = true;

  while (continueLoop && maxTurns > 0) {
    maxTurns--;
    continueLoop = false;
    const turnModelParts: Array<Record<string, unknown>> = [];

    const stream = await ai.models.generateContentStream({
      model: FLASH_LITE_35,
      contents: contents as unknown as Parameters<
        typeof ai.models.generateContentStream
      >[0]["contents"],
      config: {
        systemInstruction,
        seed: GEMINI_SEED,
        tools: [{ functionDeclarations: ADVISOR_TOOL_DECLARATIONS }],
      },
    });

    for await (const chunk of stream) {
      if (chunk.candidates?.[0]?.content?.parts) {
        for (const part of chunk.candidates[0].content.parts) {
          turnModelParts.push(part as unknown as Record<string, unknown>);
        }
      }

      let text = "";
      try {
        if (chunk.candidates?.[0]?.content?.parts) {
          for (const part of chunk.candidates[0].content.parts) {
            if (part.text) text += part.text;
          }
        } else {
          text = chunk.text ?? "";
        }
      } catch {
        text = "";
      }

      if (text) {
        fullText += text;
        writer.delta(text);
      }

      let funcCalls = chunk.functionCalls;
      if (!funcCalls && chunk.candidates?.[0]?.content?.parts) {
        const callParts = chunk.candidates[0].content.parts.filter(
          (p) => p.functionCall,
        );
        if (callParts.length > 0) {
          funcCalls = callParts.map((p) => p.functionCall!);
        }
      }

      if (funcCalls && funcCalls.length > 0) {
        for (const call of funcCalls) {
          if (!call.name) continue;

          if (isReadTool(call.name)) {
            const readResult = await executeReadTool(
              call.name,
              (call.args as Record<string, unknown>) ?? {},
              input.userId,
            );

            contents.push({
              role: "model",
              parts:
                turnModelParts.length > 0
                  ? turnModelParts
                  : [{ functionCall: call }],
            });
            contents.push({
              role: "user",
              parts: [
                {
                  functionResponse: {
                    name: call.name,
                    response: { result: readResult },
                  },
                },
              ],
            });

            continueLoop = true;
          } else {
            const toolCallId = `tool-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const args = (call.args as Record<string, unknown>) ?? {};
            const explanation = formatToolExplanation(call.name, args);
            const previousState = await getToolPreviousState(
              call.name,
              args,
              input.userId,
            );

            writer.send("tool_call_request", {
              toolCallId,
              name: call.name,
              args,
              explanation,
              previousState,
            });
          }
        }
      }
    }
  }

  return fullText;
}

/**
 * Runs the interactive 3-stage academic pipeline (Audit -> Socratic Discussion -> Redaction)
 * for a single chat turn and streams the results over SSE.
 *
 * On the first (non-continuation) turn the Stage 1 Audit and the Socratic streaming call
 * run concurrently so that text reaches the user immediately without a blocking audit wait.
 * For continuation turns the audit runs first since the Socratic verdict evaluation needs
 * the audit findings to determine REQUIRES_ANSWER vs COMPLETE.
 *
 * @param writer - The SSE writer.
 * @param input - The pipeline turn input containing query, draft, cycle and history.
 * @returns The turn output including full text, grounded sources and the pipeline result.
 */
export async function runPipelineTurn(
  writer: PipelineSseWriter,
  input: PipelineTurnInput,
): Promise<PipelineTurnOutput> {
  // ── CONTINUATION TURN ───────────────────────────────────────────────────────
  // Run audit first so the Socratic verdict evaluation has full findings context.
  if (input.isContinuation) {
    writer.send("stage_start", { stage: "audit" });
    const { audit, sources } = await runStage1Audit(
      input.userId,
      input.originalDraft,
    );
    writer.send("stage_done", { stage: "audit", payload: audit });

    const auditSummary =
      audit.findings.length > 0
        ? audit.findings
            .map((finding) => `- [${finding.severity}] ${finding.message}`)
            .join("\n")
        : audit.summary;

    writer.send("stage_start", { stage: "socratic" });
    const verdict = await evaluateSocraticDiscussion(
      input.userId,
      input.originalDraft,
      audit,
      input.query,
      input.cycle,
    );

    if (verdict.state === "COMPLETE") {
      const socraticText = await streamSocraticTurn(
        writer,
        input,
        auditSummary,
        input.history,
      );
      writer.send("stage_done", { stage: "socratic", payload: verdict });

      writer.send("stage_start", { stage: "redaction" });
      const diff = await runStage3Redaction(input.originalDraft, audit);
      writer.send("stage_done", { stage: "redaction", payload: diff });
      writer.send("diff", { original: diff.original, polished: diff.polished });

      const completionText =
        socraticText.length > 0
          ? `${socraticText}\n\n### Redaksiyon Tamamlandı\nMetniniz, denetim bulgularına dayalı olarak gramer, akademik üslup ve APA 7 standartları açısından redakte edildi. Aşağıdaki yan yana görünümde orijinal ile düzeltilmiş metni karşılaştırabilirsiniz.`
          : "### Redaksiyon Tamamlandı\nMetniniz, denetim bulgularına dayalı olarak gramer, akademik üslup ve APA 7 standartları açısından redakte edildi. Aşağıdaki yan yana görünümde orijinal ile düzeltilmiş metni karşılaştırabilirsiniz.";

      return {
        text: completionText,
        sources,
        pipeline: {
          stage: "redaction",
          cycle: input.cycle,
          originalDraft: input.originalDraft,
          audit,
          verdict,
          diff,
        },
      };
    }

    const socraticText = await streamSocraticTurn(
      writer,
      input,
      auditSummary,
      input.history,
    );
    writer.send("stage_done", { stage: "socratic", payload: verdict });

    return {
      text: socraticText,
      sources,
      pipeline: {
        stage: "socratic",
        cycle: input.cycle,
        originalDraft: input.originalDraft,
        audit,
        verdict,
      },
    };
  }

  // ── FIRST TURN (parallel) ────────────────────────────────────────────────────
  // The verdict is always REQUIRES_ANSWER on turn 1, so we do not need to wait
  // for the audit before starting the Socratic stream. Fire both concurrently.
  const staticVerdict: SocraticVerdict = {
    state: "REQUIRES_ANSWER" as const,
    summary:
      "İlk tur eleştirisi sunulan taslağa dair keskin sorularla başladı.",
    readinessScore: 0,
  };

  // Signal both stages as starting simultaneously so the UI progress bar advances.
  writer.send("stage_start", { stage: "audit" });
  writer.send("stage_start", { stage: "socratic" });

  const [{ audit, sources }, socraticText] = await Promise.all([
    runStage1Audit(input.userId, input.originalDraft),
    // Stream starts immediately; audit context is not needed for this first turn
    // since verdict is always REQUIRES_ANSWER and Stage 3 is not triggered.
    streamSocraticTurn(writer, input, "", input.history),
  ]);

  writer.send("stage_done", { stage: "audit", payload: audit });
  writer.send("stage_done", { stage: "socratic", payload: staticVerdict });

  return {
    text: socraticText,
    sources,
    pipeline: {
      stage: "socratic",
      cycle: input.cycle,
      originalDraft: input.originalDraft,
      audit,
      verdict: staticVerdict,
    },
  };
}
