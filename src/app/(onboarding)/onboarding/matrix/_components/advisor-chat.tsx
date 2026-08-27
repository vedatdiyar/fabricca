"use client";

import { useState, useRef, useEffect, useLayoutEffect, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Loader2, GraduationCap, Copy, Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
}

/**
 * Client-side safety sanitizer to ensure no internal <matrix_update> machine tags leak into UI.
 */
export function cleanAdvisorMessageText(text: string): string {
  if (!text) return "";
  return text
    .replace(
      /```(?:xml|json)?\s*<matrix[_-]update\b[^>]*>[\s\S]*?(?:<\/matrix[_-]update>\s*```|```|$)/gi,
      "",
    )
    .replace(/<matrix[_-]update\b[^>]*>[\s\S]*?(?:<\/matrix[_-]update>|$)/gi, "")
    .replace(/```(?:xml|json)?\s*```/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface AdvisorChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
  streamingText?: string;
  statusMessage?: string | null;
  onEditSubmit?: (messageId: string, newContent: string) => Promise<void> | void;
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
  const [inputText, setInputText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
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

  // ChatGPT pattern: container-only scroll (never window), overflow-anchor handles streaming.
  // - Initial mount: silently align to bottom (latest messages visible) without touching window.
  // - User sent: always scroll to bottom (smooth)
  // - Assistant streaming/done: scroll only while user is near bottom (150px buffer), streaming uses "auto" to avoid jank.
  const prevMessagesLengthRef = useRef(messages.length);

  // Initial mount: align chat container to bottom instantly — fixes "latest messages more relevant" without page jump.
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    // rAF ensures layout is painted before measuring scrollHeight
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Skip the very first effect invocation (mount) — already handled by useLayoutEffect above.
    // Prevents double-scroll and ensures window.scrollY stays 0 on page open.
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevMessagesLengthRef.current = messages.length;
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const isUserSent = messages.length > prevMessagesLengthRef.current && lastMessage?.role === "user";
    prevMessagesLengthRef.current = messages.length;

    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    // Always follow when user just sent a message, otherwise respect buffer (pause auto-scroll if user scrolled up)
    if (!isUserSent && distance > 150) return;

    // Container-only scroll — does NOT affect window (unlike scrollIntoView which would shift the page).
    container.scrollTo({
      top: container.scrollHeight,
      behavior: streamingText ? "auto" : "smooth",
    });
  }, [messages, streamingText]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const targetHeight = Math.min(Math.max(scrollHeight, 38), 140);
      textareaRef.current.style.height = `${targetHeight}px`;
      textareaRef.current.style.overflowY = scrollHeight > 140 ? "auto" : "hidden";
    }
  }, [inputText]);

  useEffect(() => {
    if (editingId && editTextareaRef.current) {
      editTextareaRef.current.style.height = "auto";
      const scrollHeight = editTextareaRef.current.scrollHeight;
      editTextareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 100), 320)}px`;
      editTextareaRef.current.focus({ preventScroll: true });
    }
  }, [editingId, editDraft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const message = inputText.trim();
    setInputText("");
    await onSendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e);
    }
  };

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

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEdit();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSaveEdit();
    }
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
        {messages.map((msg) => {
          const isModel = msg.role === "model";
          const isEditing = editingId === msg.id;

          if (isEditing) {
            return (
              <div
                key={msg.id}
                className="w-full my-2 p-4 rounded-lg bg-card border border-primary/30 space-y-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-primary flex items-center gap-1.5">
                    <Pencil className="size-3" />
                    Mesajınızı Düzenleyin
                  </span>
                </div>
                <Textarea
                  ref={editTextareaRef}
                  value={editDraft}
                  onChange={(e) => {
                    setEditDraft(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(Math.max(e.target.scrollHeight, 100), 320)}px`;
                  }}
                  onKeyDown={handleEditKeyDown}
                  rows={4}
                  className="textarea-academic text-sm leading-relaxed resize-none w-full min-h-[100px] max-h-[320px] p-3"
                  placeholder="Mesajınızı düzenleyin..."
                />
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    className="h-8 text-xs px-3 rounded-md"
                  >
                    <X className="size-3.5 mr-1.5" />
                    İptal
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!editDraft.trim() || isLoading}
                    onClick={() => void handleSaveEdit()}
                    className="h-8 text-xs px-3.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Check className="size-3.5 mr-1.5" />
                    Güncelle ve Yanıtı Yenile
                  </Button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex ${isModel ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`flex flex-col gap-1 max-w-[85%] sm:max-w-[80%] ${
                  isModel ? "items-start" : "items-end"
                }`}
              >
                <div
                  className={`w-full rounded-lg p-3.5 ${
                    isModel
                      ? "bg-secondary/40 border border-border text-foreground"
                      : "bg-primary/10 border border-primary/20 text-foreground"
                  }`}
                >
                  {isModel ? (
                    <div className="space-y-2.5 text-sm font-normal leading-relaxed font-sans text-foreground">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ children }) => (
                            <h1 className="font-serif text-xl font-semibold tracking-tight text-foreground mt-3 first:mt-0">
                              {children}
                            </h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="font-serif text-base font-semibold tracking-tight text-foreground mt-2.5 first:mt-0">
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground mt-2 first:mt-0">
                              {children}
                            </h3>
                          ),
                          p: ({ children }) => (
                            <p className="text-sm font-normal leading-relaxed text-foreground">
                              {children}
                            </p>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc pl-4 space-y-1 my-1.5 text-sm font-normal text-foreground">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal pl-4 space-y-1 my-1.5 text-sm font-normal text-foreground">
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => (
                            <li className="text-sm leading-relaxed text-foreground">
                              {children}
                            </li>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-semibold text-foreground">
                              {children}
                            </strong>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-2 border-primary/60 bg-primary/5 py-2 px-3.5 my-2.5 rounded-r-md text-foreground">
                              {children}
                            </blockquote>
                          ),
                          code: ({ children }) => (
                            <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-background border border-border text-foreground">
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {cleanAdvisorMessageText(msg.content)}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm font-normal leading-relaxed font-sans whitespace-pre-wrap text-foreground">
                      {msg.content}
                    </p>
                  )}
                </div>
                {!isEditing && msg.content && msg.id !== "welcome-1" && (
                  <div className="flex items-center gap-1">
                    {!isModel && onEditSubmit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={isLoading || !!streamingText}
                        onClick={() => handleStartEdit(msg)}
                        className="size-6 rounded-md shrink-0 text-muted-foreground hover:text-foreground hover:bg-secondary/60 [&_svg]:size-3"
                        title="Düzenle"
                        aria-label="Mesajı düzenle"
                      >
                        <Pencil />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(msg.id, cleanAdvisorMessageText(msg.content))}
                      className="size-6 rounded-md shrink-0 text-muted-foreground hover:text-foreground hover:bg-secondary/60 [&_svg]:size-3"
                      title="Metni kopyala"
                      aria-label="Metni kopyala"
                    >
                      {copiedId === msg.id ? (
                        <Check className="text-primary" />
                      ) : (
                        <Copy />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Live Streaming Delta Bubble */}
        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] sm:max-w-[80%] rounded-lg p-3.5 bg-secondary/40 border border-border text-foreground">
              <div className="space-y-2.5 text-sm font-normal leading-relaxed font-sans text-foreground">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="font-serif text-xl font-semibold tracking-tight text-foreground mt-3 first:mt-0">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="font-serif text-base font-semibold tracking-tight text-foreground mt-2.5 first:mt-0">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground mt-2 first:mt-0">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="text-sm font-normal leading-relaxed text-foreground">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc pl-4 space-y-1 my-1.5 text-sm font-normal text-foreground">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-4 space-y-1 my-1.5 text-sm font-normal text-foreground">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-sm leading-relaxed text-foreground">
                        {children}
                      </li>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-foreground">
                        {children}
                      </strong>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-primary/60 bg-primary/5 py-2 px-3.5 my-2.5 rounded-r-md text-foreground">
                        {children}
                      </blockquote>
                    ),
                    code: ({ children }) => (
                      <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-background border border-border text-foreground">
                        {children}
                      </code>
                    ),
                  }}
                >
                  {cleanAdvisorMessageText(streamingText)}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {/* Loading Spinner & Status Indicator (shown while waiting for first token or during tool research) */}
        {isLoading && !streamingText && (
          <div className="flex justify-start">
            <div className="rounded-lg p-3 bg-secondary/40 border border-border text-muted-foreground flex items-center space-x-2">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              <span className="text-xs font-medium">
                {statusMessage || "Danışman muhakeme ediyor ve literatürü sınıyor..."}
              </span>
            </div>
          </div>
        )}

        {/* bottom sentinel — no JS scroll target, kept for layout stability */}
        <div aria-hidden="true" className="h-0" />
      </div>

      {/* Sticky Bottom Input Area */}
      <form
        onSubmit={handleSubmit}
        className="p-2.5 border-t border-border bg-card shrink-0 flex items-end gap-2"
      >
        <Textarea
          ref={textareaRef}
          rows={1}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Aklınızdaki ham fikri, araştırma problemini veya sorularınızı yazın..."
          disabled={isLoading || !!editingId}
          className="textarea-academic text-sm leading-snug resize-none flex-1 min-h-[38px] max-h-[140px] py-2 px-3 overflow-hidden"
        />

        <Button
          type="submit"
          disabled={!inputText.trim() || isLoading || !!editingId}
          className="h-[38px] text-xs px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all [&_svg]:size-3.5 cursor-pointer shrink-0 inline-flex items-center gap-1.5 font-medium"
        >
          {isLoading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <>
              Gönder
              <Send className="size-3" />
            </>
          )}
        </Button>
      </form>
    </div>
  );
});
