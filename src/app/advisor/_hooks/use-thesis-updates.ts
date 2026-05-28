"use client";

import { useState, Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { sendMessageAction, ChatMessage } from "../actions";
import {
  updateThesisBoxContentAction,
  updateThesisCoreFrameworkAction,
} from "../_services/db-actions";
import { ChatMessageWithMetadata } from "./use-chat-sessions";

export interface PendingFunctionCall {
  name: string;
  args: {
    boxId?: number;
    updatedContent?: string;
    updatedMethodology?: string;
  };
  id: string;
  thoughtSignature?: string;
}

export interface UseThesisUpdatesProps {
  chatHistory: ChatMessageWithMetadata[];
  selectedRefIds: number[];
  setIsPending: Dispatch<SetStateAction<boolean>>;
  updateActiveSession: (
    newMessages: ChatMessageWithMetadata[],
    newRefIds?: number[],
  ) => void;
}

export function useThesisUpdates({
  chatHistory,
  selectedRefIds,
  setIsPending,
  updateActiveSession,
}: UseThesisUpdatesProps) {
  const [pendingFunctionCall, setPendingFunctionCall] =
    useState<PendingFunctionCall | null>(null);

  /**
   * Action handler triggered when the user clicks 'Değişikliği Onayla'
   */
  const handleApproveUpdate = async () => {
    if (!pendingFunctionCall) return;

    setIsPending(true);
    try {
      let dbRes: { success: boolean; error?: string };
      let successMessage = "Tez bölümü başarıyla güncellendi! 📝";
      let localLogContent = "";

      if (pendingFunctionCall.name === "update_thesis_core_framework") {
        const coreContent = pendingFunctionCall.args.updatedMethodology || "";
        dbRes = await updateThesisCoreFrameworkAction(coreContent);
        successMessage = "Tez Anayasası Metodolojisi başarıyla güncellendi! 📜";
        localLogContent = "Tez anayasası metodoloji güncellemesi onaylandı.";
      } else {
        dbRes = await updateThesisBoxContentAction(
          pendingFunctionCall.args.boxId!,
          pendingFunctionCall.args.updatedContent!,
        );
        successMessage = "Tez bölümü başarıyla güncellendi! 📝";
        localLogContent = `Bölüm güncellemesi onaylandı. (Kutu ID: ${pendingFunctionCall.args.boxId})`;
      }

      if (dbRes.success) {
        toast.success(successMessage);

        // Construct function response message log locally
        const functionResponseMsg: ChatMessageWithMetadata = {
          role: "user",
          content: localLogContent,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          functionResponse: {
            name: pendingFunctionCall.name,
            response: { status: "success" },
            id: pendingFunctionCall.id,
          },
        };

        const nextHistory = [...chatHistory, functionResponseMsg];
        updateActiveSession(nextHistory);
        setPendingFunctionCall(null);

        // Fetch AI's follow-up response acknowledging the successful update
        const serverHistory: ChatMessage[] = nextHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
          functionCall: msg.functionCall,
          functionResponse: msg.functionResponse,
        }));

        const followUpRes = await sendMessageAction(
          "", // Empty because it's a follow-up to function call
          serverHistory,
          selectedRefIds,
        );

        if (followUpRes.success && followUpRes.functionCall) {
          // If Gemini chained another function call
          setPendingFunctionCall({
            name: followUpRes.functionCall.name,
            args: followUpRes.functionCall.args as PendingFunctionCall["args"],
            id: followUpRes.functionCall.id,
            thoughtSignature: followUpRes.functionCall.thoughtSignature,
          });
          const finalHistory = [
            ...nextHistory,
            {
              role: "assistant" as const,
              content:
                followUpRes.response ||
                "Başka bir güncelleme önerisi daha hazırladım.",
              sources: followUpRes.sources,
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              functionCall: {
                name: followUpRes.functionCall.name,
                args: followUpRes.functionCall.args,
                id: followUpRes.functionCall.id,
                thoughtSignature: followUpRes.functionCall.thoughtSignature,
              },
            },
          ];
          updateActiveSession(finalHistory);
        } else if (followUpRes.success && followUpRes.response) {
          const finalHistory = [
            ...nextHistory,
            {
              role: "assistant" as const,
              content: followUpRes.response,
              sources: followUpRes.sources,
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          ];
          updateActiveSession(finalHistory);
        }
      } else {
        toast.error(dbRes.error || "Bölüm güncellenirken hata oluştu.");
      }
    } catch {
      toast.error("Bağlantı hatası: Bölüm güncellenemedi.");
    } finally {
      setIsPending(false);
    }
  };

  /**
   * Action handler triggered when the user clicks 'Vazgeç / Reddet'
   */
  const handleRejectUpdate = async (feedbackText?: string) => {
    if (!pendingFunctionCall) return;

    const cleanFeedback = feedbackText?.trim() || "";
    const feedbackStr = cleanFeedback
      ? `Kullanıcının reddetme gerekçesi: ${cleanFeedback}`
      : "Kullanıcının reddetme gerekçesi: Belirtilmedi.";

    // Construct rejection response so model context understands it was cancelled
    const functionResponseMsg: ChatMessageWithMetadata = {
      role: "user",
      content: cleanFeedback
        ? `Bölüm güncellemesi reddedildi. Gerekçe: ${cleanFeedback}`
        : `Bölüm güncellemesi reddedildi.`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      functionResponse: {
        name: pendingFunctionCall.name,
        response: {
          status: "rejected_by_user",
          user_feedback: feedbackStr,
        },
        id: pendingFunctionCall.id,
      },
    };

    const nextHistory = [...chatHistory, functionResponseMsg];
    updateActiveSession(nextHistory);
    setPendingFunctionCall(null);

    // Call follow-up to model so it adjusts dialogue
    setIsPending(true);
    try {
      const serverHistory: ChatMessage[] = nextHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
        functionCall: msg.functionCall,
        functionResponse: msg.functionResponse,
      }));

      const followUpRes = await sendMessageAction(
        "",
        serverHistory,
        selectedRefIds,
      );

      if (followUpRes.success && followUpRes.functionCall) {
        // If Gemini chained another function call (e.g. revised proposal based on feedback)
        setPendingFunctionCall({
          name: followUpRes.functionCall.name,
          args: followUpRes.functionCall.args as PendingFunctionCall["args"],
          id: followUpRes.functionCall.id,
          thoughtSignature: followUpRes.functionCall.thoughtSignature,
        });
        const finalHistory = [
          ...nextHistory,
          {
            role: "assistant" as const,
            content:
              followUpRes.response ||
              "Eleştirileriniz doğrultusunda revize edilmiş yeni bir güncelleme önerisi daha hazırladım.",
            sources: followUpRes.sources,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            functionCall: {
              name: followUpRes.functionCall.name,
              args: followUpRes.functionCall.args,
              id: followUpRes.functionCall.id,
              thoughtSignature: followUpRes.functionCall.thoughtSignature,
            },
          },
        ];
        updateActiveSession(finalHistory);
      } else if (followUpRes.success && followUpRes.response) {
        const finalHistory = [
          ...nextHistory,
          {
            role: "assistant" as const,
            content: followUpRes.response,
            sources: followUpRes.sources,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ];
        updateActiveSession(finalHistory);
      }
    } catch {
      // Fail silently for rejection followup
    } finally {
      setIsPending(false);
    }
  };

  return {
    pendingFunctionCall,
    setPendingFunctionCall,
    handleApproveUpdate,
    handleRejectUpdate,
  };
}
