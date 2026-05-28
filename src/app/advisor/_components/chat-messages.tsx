"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { GraduationCap, Clock, Star, Loader2, Copy, Check } from "lucide-react";
import { CitationPopover, formatCitationLinks } from "./citation-popover";
import {
  ChatMessageWithMetadata,
  PendingFunctionCall,
} from "../_hooks/use-advisor";

export interface ChatMessagesProps {
  chatHistory: ChatMessageWithMetadata[];
  isPending: boolean;
  pendingFunctionCall: PendingFunctionCall | null;
  savedInsightIds: Set<number>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  handleSaveInsight: (text: string, messageIndex: number) => void;
}

export function ChatMessages({
  chatHistory,
  isPending,
  pendingFunctionCall,
  savedInsightIds,
  handleSaveInsight,
}: ChatMessagesProps) {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  const handleCopyMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };

  return (
    <>
      {chatHistory.map((msg, index) => {
        const isAssistant = msg.role === "assistant" || msg.role === "model";
        return (
          <div
            key={msg.id || `msg_${index}`}
            className={`flex gap-4 ${isAssistant ? "justify-start" : "justify-end"} max-w-4xl mx-auto`}
          >
            {/* Left Avatar for Assistant */}
            {isAssistant && (
              <div className="size-8 rounded-full bg-muted border border-border flex items-center justify-center text-foreground shrink-0 shadow">
                <GraduationCap className="size-4 text-primary" />
              </div>
            )}

            {/* Message Bubble */}
            <div className="flex flex-col max-w-[85%] space-y-2">
              <div
                className={`p-4 pb-8 pr-10 rounded-xl shadow border transition duration-150 relative ${
                  isAssistant
                    ? "bg-muted border-border rounded-tl-none text-foreground"
                    : "bg-primary border-primary rounded-tr-none text-primary-foreground"
                }`}
              >
                {isAssistant ? (
                  /* Beautiful Cyber-Academic ReactMarkdown Renderer with zero overflow */
                  <div className="prose prose-invert max-w-none text-foreground select-text text-sm">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({
                          children,
                        }: React.ComponentPropsWithoutRef<"p">) => (
                          <p className="text-sm leading-relaxed text-foreground select-text font-sans mb-3 last:mb-0">
                            {children}
                          </p>
                        ),
                        h1: ({
                          children,
                        }: React.ComponentPropsWithoutRef<"h1">) => (
                          <h2 className="text-lg font-black text-primary mt-8 mb-4 border-b border-border pb-2 select-text font-sans">
                            {children}
                          </h2>
                        ),
                        h2: ({
                          children,
                        }: React.ComponentPropsWithoutRef<"h2">) => (
                          <h3 className="text-base font-extrabold text-primary mt-6 mb-3 border-b border-border pb-1 select-text font-sans">
                            {children}
                          </h3>
                        ),
                        h3: ({
                          children,
                        }: React.ComponentPropsWithoutRef<"h3">) => (
                          <h4 className="text-sm font-bold text-primary mt-4 mb-2 select-text font-sans">
                            {children}
                          </h4>
                        ),
                        ul: ({
                          children,
                        }: React.ComponentPropsWithoutRef<"ul">) => (
                          <ul className="list-disc pl-5 text-sm leading-relaxed text-foreground select-text my-1.5 font-sans space-y-1">
                            {children}
                          </ul>
                        ),
                        ol: ({
                          children,
                        }: React.ComponentPropsWithoutRef<"ol">) => (
                          <ol className="list-decimal pl-5 text-sm leading-relaxed text-foreground select-text my-1.5 font-sans space-y-1">
                            {children}
                          </ol>
                        ),
                        li: ({
                          children,
                        }: React.ComponentPropsWithoutRef<"li">) => (
                          <li className="pl-0.5 my-0.5 text-sm leading-relaxed text-foreground select-text font-sans">
                            {children}
                          </li>
                        ),
                        pre: ({
                          children,
                        }: React.ComponentPropsWithoutRef<"pre">) => (
                          <pre className="bg-background border border-border p-4 rounded-lg my-4 font-mono text-xs overflow-x-auto text-primary">
                            {children}
                          </pre>
                        ),
                        code: ({
                          children,
                          className,
                          ...props
                        }: React.ComponentPropsWithoutRef<"code">) => {
                          const match = /language-(\w+)/.exec(className || "");
                          return match ? (
                            <code
                              className="text-primary font-mono text-xs block"
                              {...props}
                            >
                              {children}
                            </code>
                          ) : (
                            <code
                              className="bg-background text-primary px-1.5 py-0.5 rounded font-mono text-xs border border-border select-text"
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                        table: ({
                          children,
                        }: React.ComponentPropsWithoutRef<"table">) => (
                          <div className="overflow-x-auto my-4 border border-border rounded-lg max-w-full">
                            <table className="w-full text-left border-collapse text-xs select-text">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({
                          children,
                        }: React.ComponentPropsWithoutRef<"thead">) => (
                          <thead className="bg-background text-foreground font-bold border-b border-border">
                            {children}
                          </thead>
                        ),
                        tbody: ({
                          children,
                        }: React.ComponentPropsWithoutRef<"tbody">) => (
                          <tbody>{children}</tbody>
                        ),
                        tr: ({
                          children,
                        }: React.ComponentPropsWithoutRef<"tr">) => (
                          <tr className="border-b border-border hover:bg-muted/30 transition">
                            {children}
                          </tr>
                        ),
                        th: ({
                          children,
                        }: React.ComponentPropsWithoutRef<"th">) => (
                          <th className="p-3 font-semibold text-primary">
                            {children}
                          </th>
                        ),
                        td: ({
                          children,
                        }: React.ComponentPropsWithoutRef<"td">) => (
                          <td className="p-3 text-foreground font-medium">
                            {children}
                          </td>
                        ),
                        a: ({
                          href,
                          children,
                        }: React.ComponentPropsWithoutRef<"a">) => {
                          if (href && href.startsWith("citation-")) {
                            const chunkDbId = parseInt(
                              href.replace("citation-", ""),
                              10,
                            );
                            return (
                              <CitationPopover
                                chunkDbId={chunkDbId}
                                sources={msg.sources}
                              />
                            );
                          }
                          return (
                            <a
                              href={href}
                              className="text-primary hover:underline font-semibold"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {children}
                            </a>
                          );
                        },
                      }}
                    >
                      {formatCitationLinks(msg.content)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm font-sans font-medium whitespace-pre-wrap select-text leading-relaxed">
                    {msg.content}
                  </p>
                )}

                {/* Copy Button */}
                <button
                  onClick={() => handleCopyMessage(msg.content, index)}
                  className="absolute bottom-2 right-2 p-1.5 rounded bg-background border border-border text-muted-foreground hover:text-primary hover:border-primary transition cursor-pointer"
                  title="Metni Kopyala"
                >
                  {copiedIndex === index ? (
                    <Check className="size-3.5 text-primary animate-in fade-in zoom-in-95 duration-150" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>

              {/* Footer bar with Timestamp, Citation summary popup triggers & Insight triggers for Assistant */}
              {isAssistant && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-[10px] text-muted-foreground font-sans">
                  <div className="flex items-center gap-1">
                    <Clock className="size-3 text-muted-foreground" />
                    <span>{msg.timestamp}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Save brilliant analysis to AI insights */}
                    <button
                      onClick={() => handleSaveInsight(msg.content, index)}
                      disabled={savedInsightIds.has(index)}
                      className={`flex items-center gap-1 border px-2 py-0.5 rounded transition cursor-pointer ${
                        savedInsightIds.has(index)
                          ? "bg-muted border-border text-primary cursor-default"
                          : "bg-background border-border hover:border-primary hover:text-primary"
                      }`}
                    >
                      <Star
                        className={`size-3 ${savedInsightIds.has(index) ? "fill-primary text-primary" : ""}`}
                      />
                      <span>
                        {savedInsightIds.has(index)
                          ? "Fikir Sepetinde"
                          : "Fikir Sepetine Ekle"}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Footer bar for User */}
              {!isAssistant && (
                <div className="flex items-center justify-end gap-3 px-1 text-[10px] text-muted-foreground font-sans">
                  <div className="flex items-center gap-1">
                    <Clock className="size-3 text-muted-foreground" />
                    <span>{msg.timestamp}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Danışman Düşünüyor (Loading response state) */}
      {isPending && !pendingFunctionCall && (
        <div className="flex gap-4 justify-start max-w-4xl mx-auto">
          <div className="size-8 rounded-full bg-muted border border-border flex items-center justify-center text-foreground shrink-0 shadow animate-pulse">
            <GraduationCap className="size-4 text-primary" />
          </div>

          <div className="flex flex-col space-y-1 max-w-[80%]">
            <div className="bg-muted border border-border p-4 rounded-xl rounded-tl-none flex items-center gap-2">
              <Loader2 className="size-4 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground font-sans font-medium tracking-wide">
                Danışman Düşünüyor...
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
