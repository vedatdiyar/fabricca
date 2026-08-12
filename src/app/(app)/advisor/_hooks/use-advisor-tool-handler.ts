"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { updateChatMessageToolCalls } from "../actions";
import {
  executeAdvisorToolAction,
  undoAdvisorToolAction,
} from "../tool-actions";
import type { PendingToolCall } from "../_components/tool-confirmation-card";
import type { Message } from "../_lib/types";

type SetMessagesUpdater = Message[] | ((prev: Message[]) => Message[]);

interface UseAdvisorToolHandlerParams {
  setMessages: (updater: SetMessagesUpdater) => void;
}

/**
 * Executes the DB tool approval, undo and rejection workflows over the advisor chat messages.
 *
 * @param root0 - Hook dependencies.
 * @param root0.setMessages - Updater used to persist tool call statuses into the active chat messages.
 * @returns Tool confirmation action handlers.
 */
export function useAdvisorToolHandler({
  setMessages,
}: UseAdvisorToolHandlerParams) {
  const handleApproveToolCall = useCallback(
    async (toolCallId: string, name: string, args: Record<string, unknown>) => {
      const res = await executeAdvisorToolAction({ toolName: name, args });
      if (res.success) {
        toast.success(res.message);
        let targetDbId: number | undefined;
        let updatedToolCalls: PendingToolCall[] = [];

        setMessages((prev) =>
          prev.map((msg) => {
            if (!msg.toolCalls) return msg;
            const hasCall = msg.toolCalls.some(
              (tc) => tc.toolCallId === toolCallId,
            );
            if (!hasCall) return msg;

            targetDbId = msg.dbId;
            updatedToolCalls = msg.toolCalls.map((tc) =>
              tc.toolCallId === toolCallId
                ? {
                    ...tc,
                    status: "approved",
                    executionResult: res.data,
                    previousState: res.previousState,
                  }
                : tc,
            );
            return {
              ...msg,
              toolCalls: updatedToolCalls,
            };
          }),
        );

        if (targetDbId) {
          await updateChatMessageToolCalls(targetDbId, updatedToolCalls);
        }
      } else {
        toast.error(
          res.error || "İşlem gerçekleştirilemedi. Lütfen tekrar deneyin.",
        );
      }
    },
    [setMessages],
  );

  const handleUndoToolCall = useCallback(
    async (
      toolCallId: string,
      name: string,
      args: Record<string, unknown>,
      executionResult?: unknown,
      previousState?: Record<string, unknown>,
    ) => {
      const res = await undoAdvisorToolAction({
        toolName: name,
        args,
        executionResult,
        previousState,
      });

      if (res.success) {
        toast.success(res.message);
        let targetDbId: number | undefined;
        let updatedToolCalls: PendingToolCall[] = [];

        setMessages((prev) =>
          prev.map((msg) => {
            if (!msg.toolCalls) return msg;
            const hasCall = msg.toolCalls.some(
              (tc) => tc.toolCallId === toolCallId,
            );
            if (!hasCall) return msg;

            targetDbId = msg.dbId;
            updatedToolCalls = msg.toolCalls.map((tc) =>
              tc.toolCallId === toolCallId ? { ...tc, status: "undone" } : tc,
            );
            return {
              ...msg,
              toolCalls: updatedToolCalls,
            };
          }),
        );

        if (targetDbId) {
          await updateChatMessageToolCalls(targetDbId, updatedToolCalls);
        }
      } else {
        toast.error(
          res.error || "İşlem geri alınamadı. Lütfen tekrar deneyin.",
        );
      }
    },
    [setMessages],
  );

  const handleRejectToolCall = useCallback(
    async (toolCallId: string) => {
      toast.info("Veritabanı işlemi iptal edildi.");
      let targetDbId: number | undefined;
      let updatedToolCalls: PendingToolCall[] = [];

      setMessages((prev) =>
        prev.map((msg) => {
          if (!msg.toolCalls) return msg;
          const hasCall = msg.toolCalls.some(
            (tc) => tc.toolCallId === toolCallId,
          );
          if (!hasCall) return msg;

          targetDbId = msg.dbId;
          updatedToolCalls = msg.toolCalls.map((tc) =>
            tc.toolCallId === toolCallId ? { ...tc, status: "rejected" } : tc,
          );
          return {
            ...msg,
            toolCalls: updatedToolCalls,
          };
        }),
      );

      if (targetDbId) {
        await updateChatMessageToolCalls(targetDbId, updatedToolCalls);
      }
    },
    [setMessages],
  );

  return { handleApproveToolCall, handleUndoToolCall, handleRejectToolCall };
}
