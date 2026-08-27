"use client";

import { useState, useRef, useEffect, useLayoutEffect, memo } from "react";
import { Loader2, GraduationCap } from "lucide-react";
import {
  AdvisorMarkdown,
  cleanAdvisorMessageText,
} from "./advisor-chat/advisor-markdown";
import { AdvisorMessageItem } from "./advisor-chat/advisor-message-item";
import { AdvisorChatInput } from "./advisor-chat/advisor-chat-input";

export { cleanAdvisorMessageText };

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
}

interface AdvisorChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
  streamingText?: string;
  statusMessage?: string | null;
  onEditSubmit?: (
    messageId: string,
    newContent: string,
  ) => Promise<void> | void;
}

/**
 * Single-column Socratic Academic Advisor Chat component adhering strictly to UI_RULES.md.
 * ChatGPT-like inline edit: user bubble becomes editable with Kaydet/İptal, no external revert.
 */
export const AdvisorChat = memo(function AdvisorChat({
  messages,
  onSendMessage,
  isLoading,
  streamingText = "",
  statusMessage = null,
  onEditSubmit,
}: AdvisorChatProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isInitialMountRef = useRef(true);

  const handleCopy = async (id: string, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // clipboard fallback - silently ignore
    }
  };

  const prevMessagesLengthRef = useRef(messages.length);

  // Initial mount: align chat container to bottom instantly without touching window scroll.
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevMessagesLengthRef.current = messages.length;
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const isUserSent =
      messages.length > prevMessagesLengthRef.current &&
      lastMessage?.role === "user";
    prevMessagesLengthRef.current = messages.length;

    const distance =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (!isUserSent && distance > 150) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: streamingText ? "auto" : "smooth",
    });
  }, [messages, streamingText]);

  const handleStartEdit = (msg: ChatMessage) => {
    if (isLoading || !!streamingText) return;
    setEditingId(msg.id);
    setEditDraft(msg.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editDraft.trim() || !onEditSubmit) return;
    const newContent = editDraft.trim();
    const targetId = editingId;
    setEditingId(null);
    setEditDraft("");
    await onEditSubmit(targetId, newContent);
  };

  return (
    <div className="flex flex-col h-full rounded-lg bg-card border border-border overflow-hidden">
      {/* Studio Chat Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="size-7 rounded-md border border-primary/20 bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <GraduationCap className="size-3.5" />
          </div>
          <div>
            <h2 className="font-serif text-base font-semibold tracking-tight text-foreground">
              Tez Danışmanı Müzakere Odası
            </h2>
          </div>
        </div>
      </div>

      {/* Internal Scrollable Message History */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
        style={{ overflowAnchor: "auto" }}
      >
        {messages.map((msg) => (
          <AdvisorMessageItem
            key={msg.id}
            msg={msg}
            isEditing={editingId === msg.id}
            editDraft={editDraft}
            onSetEditDraft={setEditDraft}
            onStartEdit={handleStartEdit}
            onCancelEdit={handleCancelEdit}
            onSaveEdit={() => void handleSaveEdit()}
            onCopy={handleCopy}
            copiedId={copiedId}
            isLoading={isLoading}
            streamingText={streamingText}
            onEditSubmit={onEditSubmit}
          />
        ))}

        {/* Live Streaming Delta Bubble */}
        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] sm:max-w-[80%] rounded-lg p-3.5 bg-secondary/40 border border-border text-foreground">
              <div className="space-y-2.5 text-sm font-normal leading-relaxed font-sans text-foreground">
                <AdvisorMarkdown content={streamingText} />
              </div>
            </div>
          </div>
        )}

        {/* Loading Spinner & Status Indicator */}
        {isLoading && !streamingText && (
          <div className="flex justify-start">
            <div className="rounded-lg p-3 bg-secondary/40 border border-border text-muted-foreground flex items-center space-x-2">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              <span className="text-xs font-medium">
                {statusMessage ||
                  "Danışman muhakeme ediyor ve literatürü sınıyor..."}
              </span>
            </div>
          </div>
        )}

        <div aria-hidden="true" className="h-0" />
      </div>

      {/* Sticky Bottom Input Area */}
      <AdvisorChatInput
        onSendMessage={onSendMessage}
        isLoading={isLoading}
        disabled={Boolean(editingId)}
      />
    </div>
  );
});
