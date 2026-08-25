import {
  isReadTool,
  executeReadTool,
  getToolPreviousState,
} from "@/app/(app)/advisor/_tools";
import { formatToolExplanation } from "@/app/(app)/advisor/_tools/format-tool";
import type { ChatToolCall } from "@/app/(app)/advisor/_lib/types";
import type { AdvisorStreamWriter } from "../stream";

export interface RouteFunctionCallResult {
  shouldContinue: boolean;
  toolCall?: ChatToolCall;
}

/**
 * Routes a function call to either read-tool execution or mutation request emission.
 *
 * @param call - The function call to route.
 * @param userId - Authenticated user ID.
 * @param contents - Mutable conversation contents array.
 * @param turnModelParts - Model parts collected in the current turn.
 * @param writer - SSE writer for mutation requests.
 * @returns Object with shouldContinue flag and optional pending mutation ChatToolCall.
 */
export async function routeFunctionCall(
  call: { name?: string; args?: unknown },
  userId: number,
  contents: Array<Record<string, unknown>>,
  turnModelParts: Array<Record<string, unknown>>,
  writer: AdvisorStreamWriter,
): Promise<RouteFunctionCallResult> {
  if (!call.name) return { shouldContinue: false };

  if (isReadTool(call.name)) {
    const readResult = await executeReadTool(
      call.name,
      (call.args as Record<string, unknown>) ?? {},
      userId,
    );

    contents.push({
      role: "model",
      parts:
        turnModelParts.length > 0 ? turnModelParts : [{ functionCall: call }],
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

    return { shouldContinue: true };
  }

  const toolCallId = `tool-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const args = (call.args as Record<string, unknown>) ?? {};
  const explanation = formatToolExplanation(call.name, args);
  const previousState = await getToolPreviousState(call.name, args, userId);

  const toolCall: ChatToolCall = {
    status: "pending",
    toolCallId,
    name: call.name,
    args,
    explanation,
    previousState,
  };

  writer.send("tool_call_request", {
    status: "pending",
    toolCallId,
    name: call.name,
    args,
    explanation,
    previousState,
  });

  return { shouldContinue: false, toolCall };
}



