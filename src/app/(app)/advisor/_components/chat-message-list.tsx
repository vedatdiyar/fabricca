"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Sparkles, GraduationCap, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ChatMessageItem, PersonaBadge } from "./chat-message-item";
import { MarkdownRenderer } from "./markdown-renderer";
import { ToolConfirmationCard } from "./tool-confirmation-card";
import { PipelineResultView } from "./pipeline-result-view";
import type { AdvisorPersona } from "@/features/advisor/classifier";
import type { Message } from "../_lib/types";
import type { PendingToolCall } from "./tool-confirmation-card";
import type { RagSearchResultItem } from "@/services/search/rag-search";
import type { PipelineResult } from "@/features/advisor/pipeline/types";

interface ChatMessageListProps {
  messages: Message[];
  isLoading: boolean;
  streamingText: string;
  streamingSources?: RagSearchResultItem[];
  streamingToolCalls?: PendingToolCall[];
  streamingPersona?: AdvisorPersona;
  streamingPipeline?: PipelineResult;
  activeSessionId: number | null;
  copiedMessageId: string | null;
  onCopyMessage: (messageId: string, content: string) => void;
  onCitationPosition: (messageId: string, sourceIndex: number) => void;
  onApproveToolCall: (
    toolCallId: string,
    name: string,
    args: Record<string, unknown>,
  ) => Promise<void>;
  onRejectToolCall: (toolCallId: string) => void;
  onUndoToolCall: (
    toolCallId: string,
    name: string,
    args: Record<string, unknown>,
    executionResult?: unknown,
    previousState?: Record<string, unknown>,
  ) => Promise<void>;
  onApprovePipeline?: () => void;
}

/**
 * Renders the chat message window: the empty welcome state, the message list,
 * the streaming assistant bubble, the loading indicator and the auto-scroll
 * anchor.
 *
 * @param root0 - Component props.
 * @param root0.messages - The list of persisted chat messages.
 * @param root0.isLoading - Whether the assistant is currently responding.
 * @param root0.streamingText - Accumulated streaming assistant text.
 * @param root0.streamingSources - RAG sources for the streaming message.
 * @param root0.streamingToolCalls - Pending tool calls for the streaming message.
 * @param root0.streamingPersona - Persona of the streaming message.
 * @param root0.activeSessionId - The currently active chat session id.
 * @param root0.copiedMessageId - Id of the message currently showing a copied indicator.
 * @param root0.onCopyMessage - Callback invoked when a copy button is clicked.
 * @param root0.onCitationPosition - Callback invoked when a citation badge is clicked.
 * @param root0.onApproveToolCall - Callback to approve a pending tool call.
 * @param root0.onRejectToolCall - Callback to reject a pending tool call.
 * @param root0.onUndoToolCall - Callback to undo an executed tool call.
 * @returns The chat message list markup.
 */
export function ChatMessageList({
  messages,
  isLoading,
  streamingText,
  streamingSources,
  streamingToolCalls,
  streamingPersona,
  streamingPipeline,
  activeSessionId,
  copiedMessageId,
  onCopyMessage,
  onCitationPosition,
  onApproveToolCall,
  onRejectToolCall,
  onUndoToolCall,
  onApprovePipeline,
}: ChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevSessionIdRef = useRef<number | null>(null);

  const isStreaming = isLoading || streamingToolCalls;

  useEffect(() => {
    if (!messagesEndRef.current) return;

    if (prevSessionIdRef.current !== activeSessionId) {
      prevSessionIdRef.current = activeSessionId;
      if (isStreaming) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }

    if (isStreaming) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming, activeSessionId]);

  return (
    <Card
      className={`flex-1 min-h-0 p-4 sm:p-6 rounded-md space-y-6 ${messages.length > 0 ? "overflow-y-auto" : "overflow-hidden"}`}
    >
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-12 text-center space-y-5">
          <div className="p-4 bg-primary/10 rounded-md text-primary">
            <Image
              src="/logo.svg"
              alt="Fabricca"
              width={48}
              height={48}
              className="shrink-0"
            />
          </div>
          <div className="max-w-md space-y-2">
            <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
              Akademik Danışmanınıza Hoş Geldiniz
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Kütüphanenizdeki makaleler üzerine Sokratik akademik
              yönlendirmeler alın, araştırma asistanınızla doğrudan çalışın ve
              tez matrisinizi yönetin.
            </p>
          </div>
        </div>
      ) : (
        messages.map((msg) => (
          <ChatMessageItem
            key={msg.id}
            msg={msg}
            copiedMessageId={copiedMessageId}
            onCopyMessage={onCopyMessage}
            onCitationClick={onCitationPosition}
            onApproveToolCall={onApproveToolCall}
            onRejectToolCall={onRejectToolCall}
            onUndoToolCall={onUndoToolCall}
            onApprovePipeline={onApprovePipeline}
          />
        ))
      )}

      {isLoading && (streamingText || streamingToolCalls) && (
        <div className="flex space-x-3 justify-start max-w-full">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 transition-all ${
              streamingPersona === "SOCRATIC_ADVISOR"
                ? "bg-warning/15 text-warning ring-2 ring-warning/20"
                : "bg-success/15 text-success ring-2 ring-success/20"
            }`}
          >
            {streamingPersona === "SOCRATIC_ADVISOR" ? (
              <GraduationCap className="w-4 h-4" />
            ) : (
              <BookOpen className="w-4 h-4" />
            )}
          </div>
          <div className="space-y-2 items-start flex-1 max-w-4xl min-w-0">
            <PersonaBadge persona={streamingPersona} />
            <div
              className={`p-4 rounded-md text-sm leading-relaxed rounded-tl-none break-words min-w-0 transition-all ${
                streamingPersona === "SOCRATIC_ADVISOR"
                  ? "bg-warning/5 dark:bg-warning/10 border-2 border-warning/20 text-card-foreground"
                  : "bg-success/5 dark:bg-success/10 border-2 border-success/20 text-card-foreground"
              }`}
            >
              {streamingText && (
                <MarkdownRenderer
                  content={streamingText}
                  sources={streamingSources}
                  onCitationClick={(sourceIndex) =>
                    onCitationPosition(
                      `streaming-${activeSessionId}`,
                      sourceIndex,
                    )
                  }
                />
              )}
              {streamingToolCalls?.map((tc) => (
                <ToolConfirmationCard
                  key={tc.toolCallId}
                  toolCall={tc}
                  onApprove={onApproveToolCall}
                  onReject={onRejectToolCall}
                  onUndo={onUndoToolCall}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {isLoading && streamingPipeline?.audit && (
        <div className="flex space-x-3 justify-start max-w-full">
          <div className="w-8 shrink-0" />
          <div className="flex-1 max-w-4xl min-w-0">
            <PipelineResultView
              pipeline={streamingPipeline}
              onApprove={onApprovePipeline}
            />
          </div>
        </div>
      )}

      {isLoading && !streamingText && !streamingToolCalls && (
        <div className="flex items-center space-x-3 text-muted-foreground text-xs py-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 animate-spin">
            <Sparkles className="w-4 h-4" />
          </div>
          <Card className="flex items-center space-x-2 p-3 rounded-md">
            <span className="font-medium">
              Akademik danışmanınız yanıt hazırlıyor...
            </span>
          </Card>
        </div>
      )}

      <div ref={messagesEndRef} />
    </Card>
  );
}
