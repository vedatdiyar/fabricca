"use client";

import React, { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Sparkles, AlertCircle } from "lucide-react";
import { ChatMessage } from "../actions";
import { OriginalityReport } from "./originality-report";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ChatScreenProps {
  messages: ChatMessage[];
  userResponse: string;
  setUserResponse: (val: string) => void;
  isLoading: boolean;
  isOriginalityLoading: boolean;
  error: string | null;
  handleSubmit: (e: React.FormEvent) => void;
  stepInfo: {
    label: string;
    percent: number;
    placeholder: string;
  };
}

export function ChatScreen({
  messages,
  userResponse,
  setUserResponse,
  isLoading,
  isOriginalityLoading,
  error,
  handleSubmit,
  stepInfo,
}: ChatScreenProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isOriginalityLoading]);

  // Auto-grow textarea height on input
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [userResponse]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(e);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 flex flex-col justify-between">
      {/* Scrollable Message Box */}
      <div className="space-y-6 flex-1 overflow-y-auto max-h-[600px] pr-2">
        {messages.map((msg, index) => {
          if (msg.role === "originality_report") {
            const report = msg.reportData;
            if (!report) return null;

            return (
              <OriginalityReport
                key={index}
                reportData={{
                  risk: report.risk,
                  reasoning: report.reasoning,
                  gapAnalysis: report.gapAnalysis,
                  theses: report.theses,
                }}
              />
            );
          }

          const isModel = msg.role === "model";
          return (
            <div
              key={index}
              className={`flex items-start gap-3 ${
                isModel ? "" : "flex-row-reverse"
              }`}
            >
              {/* Avatar */}
              <div
                className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full border text-xs font-semibold ${
                  isModel
                    ? "bg-secondary text-primary border-primary"
                    : "bg-primary text-primary-foreground border-border"
                }`}
              >
                {isModel ? "H" : "S"}
              </div>

              {/* Message Bubble */}
              <div
                className={`flex flex-col max-w-[80%] rounded-lg p-4 font-sans text-sm leading-relaxed ${
                  isModel
                    ? "bg-secondary text-foreground border border-border shadow-sm"
                    : "bg-primary text-primary-foreground font-medium shadow-md"
                }`}
              >
                {isModel ? (
                  <div className="prose prose-invert max-w-none text-foreground font-sans text-sm">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => (
                          <p className="text-sm leading-relaxed text-foreground select-text font-sans mb-3 last:mb-0">
                            {children}
                          </p>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          );
        })}

        {/* Originality Checking Indicator */}
        {isOriginalityLoading && (
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full border bg-secondary text-primary border-primary text-xs font-semibold">
              T
            </div>
            <div className="bg-secondary text-primary border border-primary/30 rounded-lg p-4 flex items-center space-x-3 shadow-md animate-pulse">
              <span className="text-xs font-semibold tracking-wider uppercase font-mono text-primary flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 animate-spin" />
                Tezara veri tabanı taranıyor ve özgünlük analizi yapılıyor...
              </span>
              <div className="flex space-x-1 shrink-0">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce delay-75" />
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce delay-150" />
              </div>
            </div>
          </div>
        )}

        {/* Professor Typing Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full border bg-secondary text-primary border-primary text-xs font-semibold">
              H
            </div>
            <div className="bg-secondary text-muted-foreground border border-border rounded-lg p-4 flex items-center space-x-2">
              <span className="text-xs">Hoca düşünüyor</span>
              <div className="flex space-x-1">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce delay-75" />
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce delay-150" />
              </div>
            </div>
          </div>
        )}

        {/* Error Box */}
        {error && (
          <Alert
            variant="destructive"
            className="border-destructive bg-destructive/10 text-destructive-foreground"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive-foreground" />
            <AlertDescription className="text-xs font-semibold leading-none">
              <span className="font-bold">Hata Oluştu:</span> {error}
            </AlertDescription>
          </Alert>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input & Form Box */}
      <form
        onSubmit={handleFormSubmit}
        className="border-t border-border pt-4 mt-4"
      >
        <div className="flex flex-col space-y-2">
          <div className="flex justify-between items-center text-xs text-muted-foreground px-1">
            <span>{stepInfo.label}</span>
            <span>{stepInfo.percent}% Tamamlandı</span>
          </div>
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={userResponse}
              onChange={(e) => setUserResponse(e.target.value)}
              placeholder={stepInfo.placeholder}
              rows={2}
              className="flex-1 bg-secondary text-foreground border border-border rounded-lg p-3 font-sans text-sm focus-visible:ring-1 focus-visible:ring-primary placeholder-muted-foreground resize-none overflow-y-auto max-h-32"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleFormSubmit(e);
                }
              }}
            />
            <button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium px-4 rounded-lg flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
              disabled={isLoading || !userResponse.trim()}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
