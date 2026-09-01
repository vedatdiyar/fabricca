import { HarmCategory, HarmBlockThreshold, ThinkingLevel } from "@google/genai";
import { getAi } from "@/core/services/ai";
import { dispatchGeminiCall } from "@/core/services/ai/gemini-scheduler";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import { ADVISOR_TOOL_DECLARATIONS } from "@/app/(app)/advisor/_tools";
import type { ChatToolCall } from "@/app/(app)/advisor/_lib/types";
import type { AdvisorStreamWriter } from "./stream";
import {
  extractTextFromChunk,
  extractFunctionCalls,
  collectModelParts,
} from "./tool-loop/stream-parser";
import { routeFunctionCall } from "./tool-loop/tool-router";

/** Resolved stream object returned by Gemini's `generateContentStream`. */
type GeminiContentStream = Awaited<
  ReturnType<ReturnType<typeof getAi>["models"]["generateContentStream"]>
>;

/** Internal inputs for the agent tool loop. */
export interface AdvisorToolLoopParams {
  systemInstruction: string;
  contents: Array<Record<string, unknown>>;
  userId: number;
}

export interface AdvisorToolLoopResult {
  text: string;
  toolCalls: ChatToolCall[];
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
 * @returns The full accumulated assistant text and list of triggered tool calls.
 */
export async function runAdvisorToolLoop(
  writer: AdvisorStreamWriter,
  params: AdvisorToolLoopParams,
): Promise<AdvisorToolLoopResult> {
  const { systemInstruction, contents, userId } = params;

  let fullText = "";
  const toolCalls: ChatToolCall[] = [];
  let maxTurns = 5;
  let continueLoop = true;

  while (continueLoop && maxTurns > 0) {
    maxTurns--;
    continueLoop = false;
    const turnModelParts: Array<Record<string, unknown>> = [];

    const stream = await dispatchGeminiCall<GeminiContentStream>({
      model: FLASH_LITE_35,
      lane: "interactive",
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
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
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
      turnModelParts.push(...collectModelParts(chunk as never));

      const text = extractTextFromChunk(chunk as never);
      if (text) {
        fullText += text;
        writer.delta(text);
      }

      const funcCalls = extractFunctionCalls(chunk as never);
      if (funcCalls.length > 0) {
        for (const call of funcCalls) {
          const routeResult = await routeFunctionCall(
            call,
            userId,
            contents,
            turnModelParts,
            writer,
          );
          if (routeResult.toolCall) {
            toolCalls.push(routeResult.toolCall);
          }
          if (routeResult.shouldContinue) {
            continueLoop = true;
          }
        }
      }
    }
  }

  // If the model produced a tool call without introductory text, provide an intuitive prompt text
  if (!fullText.trim() && toolCalls.length > 0) {
    const defaultText =
      "Talebiniz doğrultusunda veritabanı işlemi hazırlandı. Aşağıdaki karttan inceleyip onaylayabilirsiniz:";
    fullText = defaultText;
    writer.delta(defaultText);
  }

  return { text: fullText, toolCalls };
}
