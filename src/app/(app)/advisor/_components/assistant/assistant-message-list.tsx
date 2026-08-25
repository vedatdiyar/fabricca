"use client";

import { useEffect, useRef } from "react";
import { Bot, Loader2, Sparkles } from "lucide-react";
import type { Message } from "@/core/db/schema";
import type { RagSearchResultItem } from "@/core/services/search/rag-search";
import { AssistantMessageItem } from "./assistant-message-item";
import { AssistantEmptyState } from "./assistant-empty-state";
import { MarkdownRenderer } from "../markdown-renderer";

interface AssistantMessageListProps {
  messages: Message[];
  isLoading: boolean;
  streamingText: string;
  streamingSources: RagSearchResultItem[];
  streamingPersona?: string;
  onCitationClick: (source: RagSearchResultItem) => void;
}

/**
 * Scrollable list of chat messages with real-time streaming deltas,
 * reasoning indicators, and empty state support.
 *
 * @param props - Component props.
 * @param props.messages - Array of persisted chat messages.
 * @param props.isLoading - Whether an API response is pending or active.
 * @param props.streamingText - Accumulated live streaming text.
 * @param props.streamingSources - Live RAG sources received during turn.
 * @param props.streamingPersona - Live persona received during turn.
 * @param props.onCitationClick - Callback when a citation badge is clicked.
 * @returns The rendered message list markup.
 */
export function AssistantMessageList({
  messages,
  isLoading,
  streamingText,
  streamingSources,
  streamingPersona,
  onCitationClick,
}: AssistantMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, isLoading]);

  const isEmpty = messages.length === 0 && !streamingText && !isLoading;

  if (isEmpty) {
    return <AssistantEmptyState />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
      {messages.map((message) => (
        <AssistantMessageItem
          key={message.id}
          message={message}
          onCitationClick={onCitationClick}
        />
      ))}

      {/* Live Streaming Delta Bubble */}
      {streamingText && (
        <div className="flex items-start gap-3 w-full animate-in fade-in-50 duration-200">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary border border-primary/20 shrink-0 mt-1">
            <Bot className="size-3.5" />
          </div>

          <div className="flex-1 min-w-0 space-y-2 rounded-lg border border-border bg-card p-4 shadow-xs">
            <div className="flex items-center gap-2 border-b border-border/40 pb-2">
              <span className="px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium border border-border flex items-center gap-1">
                <Sparkles className="size-3 text-primary animate-pulse" />
                {streamingPersona === "SOCRATIC_ADVISOR" || streamingPersona === "advisor"
                  ? "Akademik Tez Danışmanı"
                  : "Tez Asistanı"}
              </span>
              <span className="text-[11px] text-muted-foreground animate-pulse">
                Yanıt üretiliyor...
              </span>
            </div>

            <div className="text-xs leading-relaxed text-card-foreground">
              <MarkdownRenderer
                content={streamingText}
                sources={streamingSources}
                onCitationClick={(idx) => {
                  if (streamingSources[idx]) {
                    onCitationClick(streamingSources[idx]);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Loading & RAG Search Indicator */}
      {isLoading && !streamingText && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg border border-border/60 bg-card/60 text-xs text-muted-foreground w-fit animate-pulse">
          <Loader2 className="size-3.5 animate-spin text-primary" />
          <span>Tez mimarisi ve kütüphane literatürü taranıyor...</span>
        </div>
      )}

      <div ref={bottomRef} className="h-2" />
    </div>
  );
}
