"use client";

import { useState } from "react";
import { Copy, Check, Sparkles, User, BookOpen, Bot } from "lucide-react";
import type { Message } from "@/core/db/schema";
import type { RagSearchResultItem } from "@/core/services/search/rag-search";
import { MarkdownRenderer } from "../markdown-renderer";

interface AssistantMessageItemProps {
  message: Pick<Message, "id" | "role" | "content" | "persona" | "sources" | "createdAt"> & {
    sources?: RagSearchResultItem[] | null;
  };
  onCitationClick?: (source: RagSearchResultItem) => void;
}

/**
 * Individual chat bubble rendering user and assistant messages with markdown support,
 * persona tags, and clickable citations.
 *
 * @param props - Component props.
 * @param props.message - The message data object.
 * @param props.onCitationClick - Callback when a cited literature source is clicked.
 * @returns The rendered message item markup.
 */
export function AssistantMessageItem({
  message,
  onCitationClick,
}: AssistantMessageItemProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const personaLabel =
    message.persona === "SOCRATIC_ADVISOR" || message.persona === "advisor"
      ? "Akademik Tez Danışmanı"
      : "Tez Asistanı";

  const sourceItems: RagSearchResultItem[] = Array.isArray(message.sources)
    ? (message.sources as RagSearchResultItem[])
    : [];

  if (isUser) {
    return (
      <div className="flex justify-end w-full">
        <div className="flex items-start gap-2.5 max-w-[85%] sm:max-w-[75%]">
          <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
            {message.content}
          </div>
          <div className="p-1.5 rounded-full bg-secondary text-secondary-foreground border border-border shrink-0 mt-0.5">
            <User className="size-3.5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 w-full group">
      <div className="p-1.5 rounded-md bg-primary/10 text-primary border border-primary/20 shrink-0 mt-1">
        <Bot className="size-3.5" />
      </div>

      <div className="flex-1 min-w-0 space-y-2 rounded-lg border border-border bg-card p-4 shadow-xs">
        {/* Header: Persona & Action Buttons */}
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium border border-border flex items-center gap-1">
              <Sparkles className="size-3 text-primary" />
              {personaLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            title="Metni Kopyala"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="size-3 text-primary" />
                <span>Kopyalandı</span>
              </>
            ) : (
              <>
                <Copy className="size-3" />
                <span>Kopyala</span>
              </>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="text-xs leading-relaxed text-card-foreground">
          <MarkdownRenderer
            content={message.content}
            sources={sourceItems}
            onCitationClick={(idx) => {
              if (sourceItems[idx] && onCitationClick) {
                onCitationClick(sourceItems[idx]);
              }
            }}
          />
        </div>

        {/* Cited Sources Strip */}
        {sourceItems.length > 0 && (
          <div className="pt-2 border-t border-border/40 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <BookOpen className="size-3 text-primary" />
              <span>İlgili Kütüphane Kaynakları ({sourceItems.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sourceItems.map((source, index) => (
                <button
                  key={`${source.resourceId}-${source.chunkIndex}-${index}`}
                  type="button"
                  onClick={() => onCitationClick && onCitationClick(source)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background hover:bg-muted/40 hover:border-primary/30 transition-colors text-[11px] text-foreground text-left cursor-pointer max-w-full truncate"
                >
                  <span className="font-mono text-primary font-semibold text-[10px]">
                    [{index + 1}]
                  </span>
                  <span className="truncate max-w-[200px] sm:max-w-[280px]">
                    {source.resourceTitle}
                  </span>
                  {source.pageNumber && (
                    <span className="font-mono text-muted-foreground text-[10px]">
                      s. {source.pageNumber}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
