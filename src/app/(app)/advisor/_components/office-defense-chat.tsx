"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  Swords,
  User,
  GraduationCap,
  MessageSquare,
  Copy,
  Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  JuryCritique,
  OfficeReviewReport,
} from "../_services/pipeline/types";

const chatMarkdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-2.5 last:mb-0 leading-relaxed text-sm text-foreground font-sans">
      {children}
    </p>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/70 bg-primary/5 pl-3.5 py-1.5 my-2.5 rounded-r-md text-sm text-foreground/95 italic font-serif">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-foreground/90">{children}</em>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside pl-5 space-y-1 my-2 text-sm text-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside pl-5 space-y-1 my-2 text-sm text-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed [&>p]:inline [&>p]:mb-0">{children}</li>
  ),
};

export interface DefenseMessage {
  id: string | number;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  isStreaming?: boolean;
}

export interface OfficeDefenseChatProps {
  sessionId?: number;
  messages: DefenseMessage[];
  isStreaming: boolean;
  hasStartedDefense: boolean;
  activeCritique: JuryCritique | null;
  report?: OfficeReviewReport;
  className?: string;
  hideHeader?: boolean;
  onSendMessage: (text: string) => Promise<void>;
  onStartDefense: (initialCritique?: JuryCritique) => void;
}

/**
 * Live Office Defense & Negotiation Chat Component.
 * Conducts real-time Socratic dialogue between the thesis student and professor.
 */
export function OfficeDefenseChat({
  messages,
  isStreaming,
  hasStartedDefense,
  activeCritique,
  className,
  hideHeader = false,
  onSendMessage,
  onStartDefense,
}: OfficeDefenseChatProps) {
  const [inputText, setInputText] = useState("");
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Adjust textarea height on change or reset
  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(Math.max(el.scrollHeight, 40), 130);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > 130 ? "auto" : "hidden";
  };

  const handleCopy = async (id: string | number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || isStreaming) return;
    const textToSend = inputText.trim();
    setInputText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
      textareaRef.current.style.overflowY = "hidden";
    }
    await onSendMessage(textToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col min-h-0 bg-card rounded-lg border border-border overflow-hidden shadow-xs",
        className,
      )}
    >
      {/* Panel Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between p-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary border border-primary/20">
              <MessageSquare className="size-3.5" />
            </div>
            <div>
              <h3 className="font-serif text-base font-semibold tracking-tight text-foreground">
                Danışmanla Canlı Müzakere Masası
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {hasStartedDefense
                  ? "Danışman hocanızla şerhleri ve savunma argümanlarınızı yüz yüze müzakere edin."
                  : "Sol paneldeki şerhleri inceledikten sonra oturumu başlatın."}
              </p>
            </div>
          </div>

          {activeCritique && (
            <span className="text-xs px-2.5 py-1 rounded-md bg-warning/10 text-warning border border-warning/20 font-medium truncate max-w-[200px]">
              Odak: {activeCritique.title}
            </span>
          )}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!hasStartedDefense ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
            <div className="p-3.5 rounded-full bg-primary/10 text-primary mb-3 border border-primary/20">
              <Swords className="size-6" />
            </div>
            <h4 className="font-serif text-base font-semibold text-foreground mb-1">
              Danışmanın Kapısını Çalın
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              Sol paneldeki kenar notlarını ve jüri şerhlerini inceledikten
              sonra savunma oturumunu başlatın. Danışmanınız en kritik itiraz
              noktasını masaya getirecektir.
            </p>
            <Button
              onClick={() => onStartDefense(activeCritique || undefined)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium gap-2 cursor-pointer shadow-xs px-4 h-9"
            >
              <Swords className="size-3.5" />
              <span>Savunmaya Başla (Müzakereyi Aç)</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isAdvisor = msg.role === "assistant";
              const isCopied = copiedId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${
                    isAdvisor ? "justify-start" : "justify-end"
                  }`}
                >
                  {isAdvisor && (
                    <div className="size-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0 mt-0.5">
                      <GraduationCap className="size-3.5" />
                    </div>
                  )}

                  <div
                    className={`group relative flex flex-col max-w-[85%] sm:max-w-[78%] rounded-xl p-3.5 text-sm leading-relaxed ${
                      isAdvisor
                        ? "bg-card border border-border text-foreground shadow-xs"
                        : "bg-primary/10 border border-primary/25 text-foreground shadow-xs"
                    }`}
                  >
                    <div
                      className={`flex items-center justify-between gap-3 mb-1.5 pb-1 border-b ${
                        isAdvisor ? "border-border/40" : "border-primary/20"
                      }`}
                    >
                      <span className="font-semibold text-xs opacity-90">
                        {isAdvisor ? "Danışman Profesör" : "Siz (Tez Yazarı)"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {msg.createdAt && (
                          <span className="text-xs opacity-60">
                            {msg.createdAt}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                          title="Metni Kopyala"
                        >
                          {isCopied ? (
                            <Check className="size-3 text-primary" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="text-sm">
                      {isAdvisor ? (
                        <div className="prose-sm dark:prose-invert max-w-none">
                          {!msg.content && msg.isStreaming ? (
                            <div className="flex items-center gap-1.5 py-1.5 px-0.5 text-muted-foreground">
                              <span className="size-2 rounded-full bg-primary/70 animate-bounce [animation-delay:-0.3s]" />
                              <span className="size-2 rounded-full bg-primary/70 animate-bounce [animation-delay:-0.15s]" />
                              <span className="size-2 rounded-full bg-primary/70 animate-bounce" />
                            </div>
                          ) : (
                            <>
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={chatMarkdownComponents}
                              >
                                {msg.content}
                              </ReactMarkdown>
                              {msg.isStreaming && (
                                <span className="inline-block w-1.5 h-3.5 bg-primary ml-1 animate-pulse align-middle" />
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap font-sans">
                          {msg.content}
                        </div>
                      )}
                    </div>
                  </div>

                  {!isAdvisor && (
                    <div className="size-7 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
                      <User className="size-3.5" />
                    </div>
                  )}
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Form */}
      {hasStartedDefense && (
        <div className="p-3 border-t border-border bg-card/90 shrink-0">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                adjustHeight();
              }}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              placeholder="Savunma argümanınızı yazın... (Enter ile gönder, Shift+Enter ile alt satır)"
              className="min-h-[40px] max-h-[130px] text-sm px-3 py-2 bg-background border-border resize-none leading-normal flex-1 rounded-md overflow-hidden"
              rows={1}
            />

            <Button
              type="button"
              onClick={handleSend}
              disabled={!inputText.trim() || isStreaming}
              className="h-10 w-10 p-0 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 cursor-pointer shadow-xs flex items-center justify-center mb-0"
            >
              {isStreaming ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
