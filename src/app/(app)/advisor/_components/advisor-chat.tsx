"use client";

import { useRef, useEffect } from "react";
import { Sparkles, Send, User, Copy, Check } from "lucide-react";
import Image from "next/image";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ToolConfirmationCard } from "./tool-confirmation-card";
import { ChatSidebar } from "./chat-sidebar";
import { MarkdownRenderer } from "./markdown-renderer";
import { CitationPopoverContent } from "./citation-popover-content";
import { useAdvisorChat } from "./use-advisor-chat";
import type { AdvisorChatProps } from "./types";

/**
 * Interactive Advisor Chat component delivering an academic AI conversation backed by Hybrid RAG & Cohere Rerank with persistent chat history sidebar and Function Calling database tools.
 *
 * @param root0 - Component props.
 * @param root0.initialSessionId - The session id to restore on mount, if any.
 * @returns The AdvisorChat UI element.
 */
export function AdvisorChat({ initialSessionId }: AdvisorChatProps) {
  const {
    messages,
    inputQuery,
    setInputQuery,
    isLoading,
    activeCitation,
    setActiveCitation,
    sessions,
    activeSessionId,
    streamingText,
    streamingSources,
    streamingToolCalls,
    copiedMessageId,
    setCopiedMessageId,
    activeSource,
    handleSelectSession,
    handleCreateSession,
    handleDeleteSession,
    handleApproveToolCall,
    handleUndoToolCall,
    handleRejectToolCall,
    handleSend,
    handleCitationPosition,
  } = useAdvisorChat(initialSessionId);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, streamingToolCalls]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [inputQuery]);

  useEffect(() => {
    const resize = () => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <div className="w-full flex gap-6 min-h-0 h-[calc(100vh-8.5rem)]">
      {/* Sidebar */}
      <div className="hidden lg:flex flex-col min-h-0 w-72 shrink-0 h-full">
        <ChatSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onCreateSession={handleCreateSession}
          onDeleteSession={handleDeleteSession}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* Chat Window */}
        <div
          className={`flex-1 min-h-0 p-4 sm:p-6 bg-card border border-border/40 rounded-md space-y-6 ${messages.length > 0 ? "overflow-y-auto" : "overflow-hidden"}`}
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
                <h2 className="text-lg font-semibold text-foreground">
                  Akademik Danışmanınıza Hoş Geldiniz
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Kütüphanenizdeki makaleler üzerine yapay zeka destekli
                  akademik analizler alın ve tez matrisinizi doğrudan yönetin.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === "user";

              return (
                <div
                  key={msg.id}
                  className={`flex space-x-3 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1 overflow-hidden">
                      <Image
                        src="/logo.svg"
                        alt="Fabricca"
                        width={20}
                        height={20}
                      />
                    </div>
                  )}

                  <div
                    className={`space-y-2 ${isUser ? "items-end max-w-3xl" : "items-start flex-1 max-w-4xl"}`}
                  >
                    <div
                      className={`p-4 rounded-md text-sm leading-relaxed ${
                        isUser
                          ? "bg-primary/10 border border-primary/20 text-foreground rounded-tr-none"
                          : "bg-card border border-border/40 text-card-foreground rounded-tl-none"
                      }`}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        <>
                          <MarkdownRenderer
                            content={msg.content}
                            sources={msg.sources}
                            onCitationClick={(sourceIndex) =>
                              handleCitationPosition(msg.id, sourceIndex)
                            }
                          />

                          {msg.toolCalls?.map((tc) => (
                            <ToolConfirmationCard
                              key={tc.toolCallId}
                              toolCall={tc}
                              onApprove={handleApproveToolCall}
                              onReject={handleRejectToolCall}
                              onUndo={handleUndoToolCall}
                            />
                          ))}
                        </>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(msg.content);
                            setCopiedMessageId(msg.id);
                            setTimeout(() => setCopiedMessageId(null), 1500);
                          }}
                          className="transition-colors text-muted-foreground hover:text-foreground"
                        >
                          {copiedMessageId === msg.id ? (
                            <Check
                              className={`w-3.5 h-3.5 ${isUser ? "text-primary" : "text-success"}`}
                            />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <div
                          className={`text-[10px] text-muted-foreground ${
                            isUser ? "ml-auto" : ""
                          }`}
                        >
                          {msg.timestamp}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0 mt-1">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {isLoading && (streamingText || streamingToolCalls) && (
            <div className="flex space-x-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1 overflow-hidden">
                <Image src="/logo.svg" alt="Fabricca" width={20} height={20} />
              </div>
              <div className="space-y-2 items-start flex-1 max-w-4xl">
                <div className="p-4 rounded-md text-sm leading-relaxed bg-card border border-border/40 text-card-foreground rounded-tl-none">
                  {streamingText && (
                    <MarkdownRenderer
                      content={streamingText}
                      sources={streamingSources}
                      onCitationClick={(sourceIndex) =>
                        handleCitationPosition(
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
                      onApprove={handleApproveToolCall}
                      onReject={handleRejectToolCall}
                      onUndo={handleUndoToolCall}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {isLoading && !streamingText && !streamingToolCalls && (
            <div className="flex items-center space-x-3 text-muted-foreground text-xs py-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 animate-spin">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex items-center space-x-2 bg-card border border-border/40 p-3 rounded-md">
                <span className="font-medium">
                  Akademik danışmanınız yanıt hazırlıyor...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Box */}
        <div className="mt-4 p-2 bg-card border border-border/40 rounded-lg flex items-end space-x-2">
          <textarea
            ref={textareaRef}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Akademik danışmanınıza kütüphaneniz veya tez yapınızla ilgili bir soru sorun..."
            rows={1}
            className="flex-1 p-3 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none overflow-y-auto max-h-50 min-h-11"
          />

          <button
            onClick={() => handleSend()}
            disabled={isLoading || !inputQuery.trim()}
            className="p-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Citation Dialog */}
      <Dialog
        open={activeCitation !== null}
        onOpenChange={(open) => {
          if (!open) setActiveCitation(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {activeSource && <CitationPopoverContent source={activeSource} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
