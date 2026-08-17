import { HarmCategory, HarmBlockThreshold, ThinkingLevel } from "@google/genai";
import { getAi } from "@/services/ai";
import { dispatchGeminiCall } from "@/services/ai/gemini-scheduler";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import { buildAdvisorTurnPromptPayload } from "./prompts/turn.prompt";
import { sanitizeModelStreamText } from "@/lib/text-sanitizer";
import { classifyAdvisorIntent } from "./classifier";
import {
  ADVISOR_TOOL_DECLARATIONS,
  isReadTool,
  executeReadTool,
  getToolPreviousState,
} from "@/features/advisor/tools";
import { formatToolExplanation } from "@/features/advisor/tools/format-tool";
import { runPipelineTurn } from "@/features/advisor/pipeline/orchestrator";
import { formatRagSourceContext } from "@/features/advisor/pipeline/context";
import {
  performHybridRagSearch,
  type RagSearchResultItem,
} from "@/services/search/rag-search";
import type { AdvisorStreamWriter } from "./stream";

/** Inputs driving a single advisor chat turn. */
export interface AdvisorTurnParams {
  userId: number;
  query: string;
  history?: Array<{ role: "user" | "model"; content: string }>;
}

/** Resolved stream object returned by Gemini's `generateContentStream`. */
type GeminiContentStream = Awaited<
  ReturnType<ReturnType<typeof getAi>["models"]["generateContentStream"]>
>;

/** Internal inputs for the agent tool loop. */
interface AdvisorToolLoopParams {
  systemInstruction: string;
  contents: Array<Record<string, unknown>>;
  userId: number;
}

/**
 * Runs the multi-turn Gemini agent loop, streaming text deltas and routing
 * function calls into either read-tool execution or pending mutation confirmations.
 *
 * Read-tool results are fed straight back into the conversation; mutation calls
 * emit a `tool_call_request` event for client-side approval and stop the loop.
 *
 * @param writer - The SSE writer for deltas and tool call events.
 * @param params - The system instruction, mutable contents, and user id.
 * @returns The full accumulated assistant text.
 */
async function runAdvisorToolLoop(
  writer: AdvisorStreamWriter,
  params: AdvisorToolLoopParams,
): Promise<string> {
  const { systemInstruction, contents, userId } = params;

  let fullText = "";
  let maxTurns = 5;
  let continueLoop = true;

  while (continueLoop && maxTurns > 0) {
    maxTurns--;
    continueLoop = false;
    const turnModelParts: Array<Record<string, unknown>> = [];

    const stream = await dispatchGeminiCall<GeminiContentStream>({
      model: FLASH_LITE_35,
      task: async ({ model, apiKey }) => {
        const ai = getAi(apiKey);
        const stream = await ai.models.generateContentStream({
          model,
          contents: contents as unknown as Parameters<
            typeof ai.models.generateContentStream
          >[0]["contents"],
          config: {
            systemInstruction,
            seed: GEMINI_SEED,
            tools: [{ functionDeclarations: ADVISOR_TOOL_DECLARATIONS }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            safetySettings: [
              {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
              {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
              {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
              {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
            ],
          },
        });
        return stream;
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
        const clean = sanitizeModelStreamText(text);
        fullText += clean;
        writer.delta(clean);
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
              userId,
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
            const toolCallId = `tool-${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 7)}`;
            const args = (call.args as Record<string, unknown>) ?? {};
            const explanation = formatToolExplanation(call.name, args);
            const previousState = await getToolPreviousState(
              call.name,
              args,
              userId,
            );

            writer.send("tool_call_request", {
              status: "pending",
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

  let sources: RagSearchResultItem[] = [];

  // Fast-Path: Skip heavy RAG literature search for direct database action queries
  if (!isAction) {
    sources = await performHybridRagSearch({ query: params.query, topK: 7 });
  }

  let contextText = "";
  if (sources.length > 0) {
    contextText = formatRagSourceContext(sources, {
      includePartialNotice: true,
    });
  } else if (isAction) {
    contextText =
      "Kullanıcı doğrudan bir veritabanı/araç işlemi gerçekleştirmek istemektedir. İlgili aracı (function call) uygun parametrelerle hemen çağırın.";
  } else {
    contextText =
      "Kütüphanenizde bu sorguyla doğrudan eşleşen veya yeterince alakalı bir kaynak bulunamadı. Lütfen sorgunuzu kütüphanenizdeki mevcut konulara yönelik olarak yeniden formüle edin.";
  }

  const userMessageText = `Kütüphane Kaynak Bağlamı:\n${contextText}\n\nKullanıcı Sorgusu:\n${params.query}`;
  const payload = buildAdvisorTurnPromptPayload(persona, userMessageText);

  const contents: Array<Record<string, unknown>> = [];

  if (params.history && params.history.length > 0) {
    for (const msg of params.history.slice(-6)) {
      contents.push({ role: msg.role, parts: [{ text: msg.content }] });
    }
  }

  contents.push({ role: "user", parts: [{ text: payload.userPrompt }] });

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
