"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  BookOpen,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Bot,
  User,
  FileText,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { sendAdvisorQueryAction } from "../actions";
import type { RagSearchResultItem } from "@/lib/services/rag-search";

interface Message {
  id: string;
  role: "user" | "model";
  content: string;
  sources?: RagSearchResultItem[];
  timestamp: string;
}

const RECOMMENDED_PROMPTS = [
  "Kütüphanemdeki makalelerin temel hipotezlerini ve ortak bulgularını özetle.",
  "Yüklediğim çalışmalardaki metodolojik yaklaşımları karşılaştır.",
  "Tez konumla ilgili anahtar kavramların literatürdeki farklı tanımları nelerdir?",
  "Kütüphanedeki kaynaklarda tespit edilen araştırma boşluklarını (research gaps) listele.",
];

/**
 * Interactive Advisor Chat component delivering an academic AI conversation backed by Hybrid RAG & Cohere Rerank.
 *
 * @returns The AdvisorChat UI element.
 */
export function AdvisorChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<
    Record<string, boolean>
  >({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (overrideQuery?: string) => {
    const queryToSend = (overrideQuery || inputQuery).trim();
    if (!queryToSend || isLoading) return;

    const userMessageId = `user-${crypto.randomUUID()}`;
    const userMsg: Message = {
      id: userMessageId,
      role: "user",
      content: queryToSend,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!overrideQuery) setInputQuery("");
    setIsLoading(true);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await sendAdvisorQueryAction({
        query: queryToSend,
        history: historyPayload,
      });

      if (!res.success || !res.answer) {
        toast.error(res.error || "Yanıt alınamadı.");
        return;
      }

      const modelMessageId = `model-${crypto.randomUUID()}`;
      const modelMsg: Message = {
        id: modelMessageId,
        role: "model",
        content: res.answer,
        sources: res.sources,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setMessages((prev) => [...prev, modelMsg]);
    } catch {
      toast.error("İletişim hatası oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSourceExpand = (messageId: string) => {
    setExpandedSources((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  const handleClear = () => {
    setMessages([]);
    setExpandedSources({});
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between p-4 bg-card/80 backdrop-blur border border-border/60 rounded-2xl shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Danışman Odası
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Neon Hybrid RAG & Cohere v4 Active
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Tüm kütüphanenizdeki makaleler pgvector HNSW ve Cohere Rerank ile
              sorgulanmaktadır.
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Sohbeti Temizle</span>
          </button>
        )}
      </div>

      {/* Main Chat Window */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-card/40 border border-border/40 rounded-2xl space-y-6 shadow-inner">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center space-y-6">
            <div className="p-4 bg-primary/10 rounded-2xl text-primary">
              <Bot className="w-12 h-12" />
            </div>
            <div className="max-w-md space-y-2">
              <h2 className="text-lg font-semibold text-foreground">
                Akademik Danışmanınıza Hoş Geldiniz
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Yüklediğiniz tüm PDF makaleler LlamaParse ile ayrıştırılmış ve
                vektörleştirilmiştir. Teziniz hakkında soru sorarak akademik
                analiz alabilirsiniz.
              </p>
            </div>

            <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 text-left">
              {RECOMMENDED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="p-3.5 text-xs font-medium bg-card hover:bg-accent hover:text-accent-foreground border border-border/60 rounded-xl transition-all shadow-sm hover:shadow text-foreground flex items-start space-x-2"
                >
                  <Search className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === "user";
            const isExpanded = expandedSources[msg.id] ?? false;

            return (
              <div
                key={msg.id}
                className={`flex space-x-3 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-3xl space-y-2 ${isUser ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      isUser
                        ? "bg-primary text-primary-foreground rounded-tr-none shadow-md"
                        : "bg-card border border-border/60 text-card-foreground rounded-tl-none shadow-sm"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>

                    <div
                      className={`text-[10px] mt-2 text-right ${
                        isUser
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {msg.timestamp}
                    </div>
                  </div>

                  {/* Cited RAG Sources Badge */}
                  {!isUser && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 bg-muted/40 border border-border/50 rounded-xl overflow-hidden text-xs">
                      <button
                        onClick={() => toggleSourceExpand(msg.id)}
                        className="w-full flex items-center justify-between p-2.5 px-3 bg-muted/30 hover:bg-muted/60 transition-colors text-muted-foreground font-medium"
                      >
                        <div className="flex items-center space-x-2">
                          <BookOpen className="w-3.5 h-3.5 text-primary" />
                          <span>
                            Atıfta Bulunulan Kaynaklar ({msg.sources.length} RAG
                            Bağlamı)
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="p-3 space-y-2.5 border-t border-border/40 bg-card/60">
                          {msg.sources.map((src, sIdx) => {
                            const pageSpan = src.pageStart ?? null;
                            const pageEnd = src.pageEnd ?? pageSpan;
                            const pageRef =
                              src.printedPageNumber ??
                              (pageSpan != null && pageEnd != null
                                ? pageSpan === pageEnd
                                  ? `s. ${pageSpan}`
                                  : `ss. ${pageSpan}\u00e2\u0080\u0093${pageEnd}`
                                : null);
                            return (
                              <div
                                key={sIdx}
                                className="p-2.5 bg-background/80 border border-border/50 rounded-lg space-y-1 text-xs"
                              >
                                <div className="flex items-center justify-between font-semibold text-foreground">
                                  <div className="flex items-center space-x-1.5 truncate max-w-md">
                                    <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <span className="truncate">
                                      {src.resourceTitle}
                                    </span>
                                  </div>
                                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px]">
                                    %{(src.relevanceScore * 100).toFixed(0)}{" "}
                                    Alaka
                                  </span>
                                </div>

                                <div className="flex items-center space-x-3 text-[11px] text-muted-foreground">
                                  <span>
                                    Yazar: {src.resourceAuthors.join(", ")}
                                  </span>
                                  {pageRef && <span>Sayfa: {pageRef}</span>}
                                  {src.sectionTitle && (
                                    <span className="truncate">
                                      Bölüm: {src.sectionTitle}
                                    </span>
                                  )}
                                </div>

                                <p className="text-[11px] text-muted-foreground/90 italic bg-muted/30 p-1.5 rounded border border-border/30 line-clamp-2">
                                  &quot;{src.content}&quot;
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
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

        {isLoading && (
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
      <div className="p-2 bg-card border border-border/60 rounded-2xl shadow-md flex items-end space-x-2">
        <textarea
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
          className="flex-1 p-3 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none max-h-32 min-h-[44px]"
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
  );
}
