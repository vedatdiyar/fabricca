import { toast } from "sonner";
import type { ChatToolCall } from "@/core/db/schema";
import { updateChatMessageToolCalls } from "../message-actions";
import {
  executeAdvisorToolAction,
  undoAdvisorToolAction,
} from "../tool-actions";

/**
 * Approves a tool mutation and updates local message state.
 *
 * @param messageId - Target chat message ID.
 * @param toolCall - Tool call descriptor to execute.
 * @param onUpdate - Callback to patch local message tool call state.
 */
export async function approveToolMutation(
  messageId: number,
  toolCall: ChatToolCall,
  onUpdate: (
    messageId: number,
    toolCallId: string,
    patch: Partial<ChatToolCall>,
  ) => void,
): Promise<void> {
  const res = await executeAdvisorToolAction({
    toolName: toolCall.name,
    args: toolCall.args,
  });

  if (!res.success) {
    toast.error(res.error || "İşlem uygulanamadı.");
    return;
  }

  toast.success(res.message || "İşlem başarıyla uygulandı.");
  onUpdate(messageId, toolCall.toolCallId, {
    status: "approved",
    executionResult: res.data,
    previousState: res.previousState || toolCall.previousState,
  });
}

/**
 * Rejects a pending tool mutation.
 *
 * @param messageId - Target chat message ID.
 * @param toolCall - Tool call descriptor to reject.
 * @param onUpdate - Callback to patch local message tool call state.
 */
export function rejectToolMutation(
  messageId: number,
  toolCall: ChatToolCall,
  onUpdate: (
    messageId: number,
    toolCallId: string,
    patch: Partial<ChatToolCall>,
  ) => void,
): void {
  onUpdate(messageId, toolCall.toolCallId, { status: "rejected" });
  toast.info("İşlem talebi reddedildi.");
}

/**
 * Undoes an approved tool mutation and updates local message state.
 *
 * @param messageId - Target chat message ID.
 * @param toolCall - Tool call descriptor to undo.
 * @param onUpdate - Callback to patch local message tool call state.
 */
export async function undoToolMutation(
  messageId: number,
  toolCall: ChatToolCall,
  onUpdate: (
    messageId: number,
    toolCallId: string,
    patch: Partial<ChatToolCall>,
  ) => void,
): Promise<void> {
  const res = await undoAdvisorToolAction({
    toolName: toolCall.name,
    args: toolCall.args,
    executionResult: toolCall.executionResult,
    previousState: toolCall.previousState,
  });

  if (!res.success) {
    toast.error(res.error || "İşlem geri alınamadı.");
    return;
  }

  toast.success(res.message || "İşlem geri alındı.");
  onUpdate(messageId, toolCall.toolCallId, { status: "undone" });
}

export { updateChatMessageToolCalls };
