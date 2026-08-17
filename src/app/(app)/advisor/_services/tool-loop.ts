import { HarmCategory, HarmBlockThreshold, ThinkingLevel } from "@google/genai";
import { getAi } from "@/core/services/ai";
import { dispatchGeminiCall } from "@/core/services/ai/gemini-scheduler";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import { sanitizeModelStreamText } from "@/lib/text-sanitizer";
import {
  ADVISOR_TOOL_DECLARATIONS,
  isReadTool,
  executeReadTool,
  getToolPreviousState,
} from "@/app/(app)/advisor/_tools";
import { formatToolExplanation } from "@/app/(app)/advisor/_tools/format-tool";
import type { AdvisorStreamWriter } from "./stream";

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
export async function runAdvisorToolLoop(
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
