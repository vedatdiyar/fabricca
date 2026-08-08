"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Send, User, FileText, Copy, Check } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  getChatSessions,
  createChatSession,
  deleteChatSession,
  getChatMessages,
  saveChatMessage,
  generateChatTitleAction,
  type ChatSessionListItem,
} from "../actions";
import type { RagSearchResultItem } from "@/lib/services/rag-search";
import { ChatSidebar } from "./chat-sidebar";
import { MarkdownRenderer } from "./markdown-renderer";

interface Message {
  id: string;
  role: "user" | "model";
  content: string;
  sources?: RagSearchResultItem[];
  timestamp: string;
}

interface CitationPopoverContentProps {
  source: RagSearchResultItem;
}

/**
 * Renders the academic source details as an inline citation panel.
 *
 * @param root0 - Component props.
 * @param root0.source - The RAG source item to display.
 * @returns The citation detail markup.
 */
function CitationPopoverContent({ source }: CitationPopoverContentProps) {
  const pageSpan = source.pageStart ?? null;
  const pageEnd = source.pageEnd ?? pageSpan;
  const pageRef =
    source.printedPageNumber ??
    (pageSpan != null && pageEnd != null
      ? pageSpan === pageEnd
        ? `s. ${pageSpan}`
        : `ss. ${pageSpan}–${pageEnd}`
      : null);

  return (
    <div className="text-sm space-y-4">
      <div className="flex items-center justify-between gap-2 mt-4">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileText className="size-4 text-primary shrink-0" />
          <span className="font-medium text-foreground break-words">
            {source.resourceTitle}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[11px] shrink-0">
            %{(source.relevanceScore * 100).toFixed(0)} Alaka
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{source.resourceAuthors.join(", ")}</span>
        {pageRef && <span>{pageRef}</span>}
        {source.sectionTitle && (
          <span className="truncate">Bölüm: {source.sectionTitle}</span>
        )}
      </div>

      <div className="text-sm text-foreground/80 leading-relaxed space-y-3 pl-3 border-l-2 border-primary/20">
        {source.content.split("\n\n").map((paragraph, i) => {
          const lines = paragraph.split("\n");
          const hasNumberedItems = lines.some((l) =>
            /^\d+[.)]\s/.test(l.trim()),
          );
          if (hasNumberedItems) {
            return (
              <ol key={i} className="list-decimal list-inside space-y-1">
                {lines.map((line, j) => (
                  <li key={j}>{line.trim().replace(/^\d+[.)]\s*/, "")}</li>
                ))}
              </ol>
            );
          }
          return <p key={i}>{paragraph}</p>;
        })}
      </div>
    </div>
  );
}

interface AdvisorChatProps {
  initialSessionId?: number;
}

/**
 * Interactive Advisor Chat component delivering an academic AI conversation backed by Hybrid RAG & Cohere Rerank with persistent chat history sidebar.
 *
 * @param root0 - Component props.
 * @param root0.initialSessionId - The session id to restore on mount, if any.
 * @returns The AdvisorChat UI element.
 */
export function AdvisorChat({ initialSessionId }: AdvisorChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeCitation, setActiveCitation] = useState<{
    messageId: string;
    sourceIndex: number;
  } | null>(null);

  const [sessions, setSessions] = useState<ChatSessionListItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [streamingSources, setStreamingSources] = useState<
    RagSearchResultItem[] | undefined
  >(undefined);
  const [isStreamingDone, setIsStreamingDone] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const isSendingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

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

  const loadSessions = useCallback(async () => {
    const list = await getChatSessions();
    setSessions(list);
  }, []);

  const loadMessages = useCallback(async (sessionId: number) => {
    const res = await getChatMessages(sessionId);
    if (res.success && res.messages) {
      const mapped: Message[] = res.messages.map((m) => ({
        id: `msg-${m.id}`,
        role: m.role as "user" | "model",
        content: m.content,
        sources: (m.sources as RagSearchResultItem[] | undefined) ?? undefined,
        timestamp: m.createdAt.toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }));
      setMessages(mapped);
    } else {
      setMessages([]);
    }
    setActiveCitation(null);
  }, []);

  const syncUrlSession = useCallback(
    (sessionId: number | null) => {
      if (sessionId !== null) {
        router.push(`/advisor?session=${sessionId}`);
      } else {
        router.push("/advisor");
      }
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;
    /** Syncs active chat session with the initialSessionId route parameter. */
    async function syncSession() {
      const list = await getChatSessions();
      if (cancelled) return;
      setSessions(list);

      const targetId =
        initialSessionId !== undefined && list.some((s) => s.id === initialSessionId)
          ? initialSessionId
          : null;

      if (targetId !== null) {
        if (activeSessionId !== targetId) {
          setActiveSessionId(targetId);
          if (!cancelled) await loadMessages(targetId);
        }
      } else {
        if (activeSessionId !== null) {
          setActiveSessionId(null);
          setMessages([]);
          setActiveCitation(null);
        }
      }
    }
    void syncSession();
    return () => {
      cancelled = true;
    };
  }, [initialSessionId, activeSessionId, loadMessages]);

  const handleSelectSession = useCallback(
    async (sessionId: number) => {
      setActiveSessionId(sessionId);
      await loadMessages(sessionId);
      syncUrlSession(sessionId);
    },
    [loadMessages, syncUrlSession],
  );

  const handleCreateSession = useCallback(() => {
    setActiveSessionId(null);
    setMessages([]);
    setActiveCitation(null);
    syncUrlSession(null);
  }, [syncUrlSession]);

  const handleDeleteSession = useCallback(
    async (sessionId: number) => {
      const res = await deleteChatSession(sessionId);
      if (res.success) {
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
          setMessages([]);
          setActiveCitation(null);
          await loadSessions();
          syncUrlSession(null);
        } else {
          await loadSessions();
        }
        toast.success("Sohbet silindi.");
      } else {
        toast.error(res.error || "Sohbet silinemedi.");
      }
    },
    [activeSessionId, loadSessions, syncUrlSession],
  );

  const handleSend = async (overrideQuery?: string) => {
    if (isSendingRef.current) return;
    const queryToSend = (overrideQuery || inputQuery).trim();
    if (!queryToSend || isLoading) return;

    isSendingRef.current = true;

    let sessionId = activeSessionId;

    if (!sessionId) {
      const title =
        queryToSend.length > 60
          ? queryToSend.slice(0, 60) + "..."
          : queryToSend;
      const createRes = await createChatSession(title);
      if (!createRes.success || !createRes.sessionId) {
        toast.error(createRes.error || "Sohbet oluşturulamadı.");
        isSendingRef.current = false;
        return;
      }
      sessionId = createRes.sessionId;
      setActiveSessionId(sessionId);
      await loadSessions();
      syncUrlSession(sessionId);

      // Asynchronously generate smart topic title via Cerebras Gemma 4
      void generateChatTitleAction(sessionId, queryToSend).then((titleRes) => {
        if (titleRes.success) {
          void loadSessions();
        }
      });
    }

    const userMessageId = `user-${crypto.randomUUID()}`;
    const userMsg: Message = {
      id: userMessageId,
      role: "user",
      content: queryToSend,
      timestamp: new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!overrideQuery) setInputQuery("");
    setIsLoading(true);
    setStreamingText("");
    setStreamingSources(undefined);
    setIsStreamingDone(false);

    await saveChatMessage(sessionId, "user", queryToSend);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryToSend, history: historyPayload }),
      });

      if (!response.ok) {
        toast.error("Yanıt alınamadı.");
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);
            if (event.type === "delta") {
              setStreamingText((prev) => prev + event.text);
            } else if (event.type === "done") {
              setStreamingSources(event.sources);
              setIsStreamingDone(true);

              const modelMessageId = `model-${crypto.randomUUID()}`;
              const modelMsg: Message = {
                id: modelMessageId,
                role: "model",
                content: event.text,
                sources: event.sources,
                timestamp: new Date().toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              };
              setMessages((prev) => [...prev, modelMsg]);

              if (sessionId) {
                await saveChatMessage(
                  sessionId,
                  "model",
                  event.text,
                  event.sources ?? undefined,
                );
                await loadSessions();
              }
            } else if (event.type === "error") {
              toast.error(event.error || "Yanıt üretilirken hata oluştu.");
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } catch {
      toast.error("İletişim hatası oluştu.");
    } finally {
      setIsLoading(false);
      setStreamingText("");
      setStreamingSources(undefined);
      setIsStreamingDone(false);
      isSendingRef.current = false;
    }
  };

  const handleCitationPosition = useCallback(
    (messageId: string, sourceIndex: number) => {
      setActiveCitation((prev) => {
        if (prev?.messageId === messageId && prev.sourceIndex === sourceIndex) {
          return null;
        }
        return { messageId, sourceIndex };
      });
    },
    [],
  );

  const activeSource =
    activeCitation &&
    (() => {
      const msg = messages.find((m) => m.id === activeCitation.messageId);
      return msg?.sources?.[activeCitation.sourceIndex] ?? null;
    })();

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
          className={`flex-1 min-h-0 p-4 sm:p-6 bg-card/40 border border-border/40 rounded-2xl space-y-6 shadow-inner ${messages.length > 0 ? "overflow-y-auto" : "overflow-hidden"}`}
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center space-y-5">
              <div className="p-4 bg-primary/10 rounded-2xl text-primary">
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
                  akademik analizler alın.
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
                    className={`max-w-3xl space-y-2 ${isUser ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`p-4 rounded-2xl text-sm leading-relaxed ${
                        isUser
                          ? "bg-primary/10 border border-primary/20 text-foreground rounded-tr-none"
                          : "bg-card border border-border/60 text-card-foreground rounded-tl-none shadow-sm"
                      }`}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        <MarkdownRenderer
                          content={msg.content}
                          sources={msg.sources}
                          onCitationClick={(sourceIndex) =>
                            handleCitationPosition(msg.id, sourceIndex)
                          }
                        />
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

          {isLoading && streamingText && !isStreamingDone && (
            <div className="flex space-x-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1 overflow-hidden">
                <Image src="/logo.svg" alt="Fabricca" width={20} height={20} />
              </div>
              <div className="max-w-3xl space-y-2 items-start">
                <div className="p-4 rounded-2xl text-sm leading-relaxed bg-card border border-border/60 text-card-foreground rounded-tl-none shadow-sm">
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
                </div>
              </div>
            </div>
          )}

          {isLoading && !streamingText && (
            <div className="flex items-center space-x-3 text-muted-foreground text-xs py-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 animate-spin">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex items-center space-x-2 bg-card border border-border/60 p-3 rounded-2xl shadow-sm">
                <span className="font-medium">
                  Kütüphaneniz taranıyor ve yanıt hazırlanıyor...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Box */}
        <div className="mt-4 p-2 bg-card border border-border/60 rounded-2xl shadow-md flex items-end space-x-2">
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
            placeholder="Akademik danışmanınıza kütüphanenizle ilgili bir soru sorun..."
            rows={1}
            className="flex-1 p-3 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none overflow-y-auto max-h-[200px] min-h-[44px]"
          />

          <button
            onClick={() => handleSend()}
            disabled={isLoading || !inputQuery.trim()}
            className="p-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow"
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
