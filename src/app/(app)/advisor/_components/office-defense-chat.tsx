"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  GraduationCap,
  User,
  Swords,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { JuryCritique } from "../_services/pipeline/types";

export interface DefenseMessage {
  id: string | number;
  role: "assistant" | "user";
  content: string;
  createdAt?: string;
  isStreaming?: boolean;
}

interface OfficeDefenseChatProps {
  messages: DefenseMessage[];
  isStreaming: boolean;
  onSendMessage: (text: string) => Promise<void>;
  hasStartedDefense: boolean;
  onStartDefense: (initialCritique?: JuryCritique) => void;
  activeCritique?: JuryCritique | null;
}

const QUICK_DEFENSE_PROMPTS = [
  "Bu kavramsal tercihi seçmemin temel nedeni...",
  "Ampirik verilerim bu çerçeveyle uyumlu çünkü...",
  "Hocam haklısınız, bunu metne dipnot olarak ekleyeceğim.",
  "Metodolojik sınırlılığı nasıl giderebilirim?",
];

/**
 * Right Panel: Live Office Defense & Negotiation (Canlı Savunma ve Müzakere Alanı).
 * Socratic Professor chat negotiating the draft arguments and jury critiques.
 */
export function OfficeDefenseChat({
  messages,
  isStreaming,
  onSendMessage,
  hasStartedDefense,
  onStartDefense,
  activeCritique,
}: OfficeDefenseChatProps) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const handleSend = async () => {
    if (!inputText.trim() || isStreaming) return;
    const textToSend = inputText.trim();
    setInputText("");
    await onSendMessage(textToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickPromptClick = (prompt: string) => {
    setInputText(prompt);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Chat Header */}
      <div className="p-4 border-b border-border bg-card/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground">
                Danışmanla Canlı Müzakere Masası
              </h3>
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                Sokratik Hoca
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Argümanlarınızı savunun, teorik tercihlerinizi açıklayın ve danışmanı ikna edin.
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!hasStartedDefense ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
            <div className="p-3.5 rounded-full bg-primary/10 text-primary mb-3 border border-primary/20">
              <Swords className="h-6 w-6" />
            </div>
            <h4 className="font-serif text-base font-semibold text-foreground mb-1">
              Danışmanın Kapısını Çalın
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed mb-5">
              Sol paneldeki kenar notlarını ve jüri şerhlerini inceledikten sonra savunma oturumunu başlatın.
              Danışmanınız en kritik itiraz noktasını masaya getirecektir.
            </p>
            <Button
              onClick={() => onStartDefense(activeCritique || undefined)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium h-9 px-4 gap-2 cursor-pointer shadow-xs"
            >
              <Swords className="h-4 w-4" />
              <span>Savunmaya Başla (Müzakereyi Aç)</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isAdvisor = msg.role === "assistant";

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${
                    isAdvisor ? "justify-start" : "justify-end"
                  }`}
                >
                  {isAdvisor && (
                    <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0 mt-0.5">
                      <GraduationCap className="h-3.5 w-3.5" />
                    </div>
                  )}

                  <div
                    className={`flex flex-col max-w-[85%] sm:max-w-[78%] rounded-xl p-3 text-xs leading-relaxed ${
                      isAdvisor
                        ? "bg-card border border-border text-foreground shadow-xs"
                        : "bg-primary text-primary-foreground font-medium shadow-xs"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1 pb-1 border-b border-border/40">
                      <span className="font-semibold text-[11px] opacity-90">
                        {isAdvisor ? "Danışman Profesör" : "Siz (Tez Yazarı)"}
                      </span>
                      {msg.createdAt && (
                        <span className="text-[10px] opacity-60">
                          {msg.createdAt}
                        </span>
                      )}
                    </div>

                    <div className="whitespace-pre-wrap font-sans">
                      {msg.content}
                      {msg.isStreaming && (
                        <span className="inline-block w-1.5 h-3.5 bg-primary ml-1 animate-pulse" />
                      )}
                    </div>
                  </div>

                  {!isAdvisor && (
                    <div className="h-7 w-7 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              );
            })}

            {isStreaming && (
              <div className="flex gap-2 items-center text-xs text-muted-foreground py-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>Danışman değerlendiriyor...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Quick Prompt Pills & Input Form */}
      {hasStartedDefense && (
        <div className="p-3 border-t border-border bg-card/90 shrink-0 space-y-2.5">
          {/* Quick Prompts */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {QUICK_DEFENSE_PROMPTS.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleQuickPromptClick(p)}
                disabled={isStreaming}
                className="text-[10px] px-2.5 py-1 rounded-full bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border whitespace-nowrap transition-colors cursor-pointer shrink-0"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Text Input */}
          <div className="relative flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              placeholder="Savunma argümanınızı yazın... (Enter ile gönder)"
              className="min-h-[44px] max-h-28 text-xs p-2.5 bg-background border-border resize-none leading-relaxed flex-1"
              rows={1}
            />

            <Button
              type="button"
              onClick={handleSend}
              disabled={!inputText.trim() || isStreaming}
              className="h-10 w-10 p-0 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 cursor-pointer"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
