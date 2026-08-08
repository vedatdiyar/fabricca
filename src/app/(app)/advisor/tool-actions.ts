"use server";

import { z } from "zod";
import { getSession } from "@/lib/session";
import { executeMutationTool } from "@/lib/services/advisor-tools";

const toolActionSchema = z.object({
  toolName: z.string().min(1, "Tool name is required."),
  args: z.record(z.string(), z.unknown()),
});

export interface ExecuteAdvisorToolResult {
  success: boolean;
  message: string;
  data?: unknown;
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
      message: "Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.",
    };
  }

  const parsed = toolActionSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      message: "Geçersiz işlem parametreleri.",
    };
  }

  const { toolName, args } = parsed.data;

  try {
    const result = await executeMutationTool(toolName, args, session.userId);
    return result;
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Bilinmeyen sunucu hatası.";
    return {
      success: false,
      message: `İşlem gerçekleştirilirken hata oluştu: ${errorMsg}`,
    };
  }
}
