"use server";

import { z } from "zod";
import { getSession } from "@/lib/session";
import {
  executeMutationTool,
  undoMutationTool,
} from "@/app/(app)/advisor/_tools";
import { handleActionError } from "@/lib/errors/handle-error";

const toolActionSchema = z.object({
  toolName: z.string().min(1, "Tool name is required."),
  args: z.record(z.string(), z.unknown()),
});

export interface ExecuteAdvisorToolResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: unknown;
  previousState?: Record<string, unknown>;
}

/**
 * Server Action that executes a user-approved database mutation tool call.
 *
 * @param payload - Object containing toolName and arguments.
 * @param payload.toolName - The name of the tool to execute.
 * @param payload.args - The payload arguments for the tool call.
 * @returns Structured result with success status and user-facing Turkish message.
 */
export async function executeAdvisorToolAction(payload: {
  toolName: string;
  args: Record<string, unknown>;
}): Promise<ExecuteAdvisorToolResult> {
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.",
    };
  }

  const parsed = toolActionSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: "Geçersiz işlem parametreleri.",
    };
  }

  const { toolName, args } = parsed.data;

  try {
    const result = await executeMutationTool(toolName, args, session.userId);
    return result;
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Server Action that reverts (undoes) a previously approved and executed tool action.
 *
 * @param payload - Payload containing execution parameters and previous state.
 * @param payload.toolName - Name of the tool.
 * @param payload.args - Original tool arguments.
 * @param payload.executionResult - Result output from original execution (e.g. created record).
 * @param payload.previousState - Snapshot of state before original execution.
 * @returns Structured result with success status and user-facing Turkish message.
 */
export async function undoAdvisorToolAction(payload: {
  toolName: string;
  args: Record<string, unknown>;
  executionResult?: unknown;
  previousState?: Record<string, unknown>;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.",
    };
  }

  try {
    const result = await undoMutationTool(
      payload.toolName,
      payload.args,
      payload.executionResult,
      payload.previousState,
      session.userId,
    );
    return result;
  } catch (error) {
    return handleActionError(error);
  }
}
