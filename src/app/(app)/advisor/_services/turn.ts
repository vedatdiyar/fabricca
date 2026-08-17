import { buildAdvisorTurnPromptPayload } from "../_prompts/turn.prompt";
import { sanitizeModelStreamText } from "@/lib/text-sanitizer";
import { classifyAdvisorIntent } from "./classifier";
import { runPipelineTurn } from "@/app/(app)/advisor/_services/pipeline/orchestrator";
import type { AdvisorStreamWriter } from "./stream";
import { prepareTurnContext, buildTurnChatContents } from "./turn-context";
import { runAdvisorToolLoop } from "./tool-loop";

/** Inputs driving a single advisor chat turn. */
export interface AdvisorTurnParams {
  userId: number;
  query: string;
  history?: Array<{ role: "user" | "model"; content: string }>;
}

/**
 * Orchestrates a single advisor chat turn: intent/persona classification,
 * pipeline (Heavy Flow) vs direct (RAG + tool loop) dispatch, and the final
 * `done` event emission.
 *
 * @param writer - The SSE writer to emit events into.
 * @param params - The turn inputs including user id, query, and chat history.
 */
export async function runTurn(
  writer: AdvisorStreamWriter,
  params: AdvisorTurnParams,
): Promise<void> {
  const classification = await classifyAdvisorIntent(
    params.query,
    params.history,
  );
  const persona = classification.persona;

  // Heavy Flow is triggered by a fresh draft paragraph as classified by the intent classifier.
  const isPipelineTurn = classification.mode === "PIPELINE";

  // Immediately inform UI client of assigned persona
  writer.send("persona_assigned", { persona });

  if (isPipelineTurn) {
    const { text, sources, pipeline } = await runPipelineTurn(writer, {
      userId: params.userId,
      originalDraft: params.query,
    });

    const responsePersona = !pipeline.audit ? "SOCRATIC_ADVISOR" : persona;

    writer.send("done", {
      text: sanitizeModelStreamText(text),
      sources,
      persona: responsePersona,
      pipeline,
    });
    writer.done();
    return;
  }

  const isAction = classification.isActionQuery;

  // Prepare RAG search context & combined message prompt
  const { sources, userMessageText } = await prepareTurnContext(
    params.query,
    isAction,
  );

  const payload = buildAdvisorTurnPromptPayload(persona, userMessageText);
  const contents = buildTurnChatContents(payload.userPrompt, params.history);

  const fullText = await runAdvisorToolLoop(writer, {
    systemInstruction: payload.systemInstruction,
    contents,
    userId: params.userId,
  });

  writer.send("done", {
    text: sanitizeModelStreamText(fullText),
    sources,
    persona,
  });
  writer.done();
}
