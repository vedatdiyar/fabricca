"use client";

import { User, GraduationCap, Copy, Check, CheckSquare } from "lucide-react";
import type { Components } from "react-markdown";
import { StreamingMarkdown } from "../markdown-renderer";
import { Button } from "@/components/ui/button";
import type { DefenseMessage } from "../office-defense-chat";

const chatMarkdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-2.5 last:mb-0 leading-relaxed text-sm text-foreground font-sans">
      {children}
    </p>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/40 bg-primary/10 pl-3.5 py-1.5 my-2.5 rounded-r-md text-sm text-foreground italic font-serif">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-foreground">{children}</em>,
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

interface OfficeDefenseMessageItemProps {
  msg: DefenseMessage;
  isCopied: boolean;
  onCopy: (id: string | number, text: string) => void;
  onOpenTaskDialog: (content?: string) => void;
}

/**
 * Renders an individual message item in the live defense discussion.
 */
export function OfficeDefenseMessageItem({
  msg,
  isCopied,
  onCopy,
  onOpenTaskDialog,
}: OfficeDefenseMessageItemProps) {
  const isAdvisor = msg.role === "assistant";

  return (
    <div
      className={`flex gap-3 ${isAdvisor ? "justify-start" : "justify-end"}`}
    >
      {isAdvisor && (
        <div className="size-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
          <GraduationCap className="size-4" />
        </div>
      )}

      <div
        className={`group relative flex flex-col max-w-[88%] sm:max-w-[82%] rounded-lg p-4 text-sm leading-relaxed ${
          isAdvisor
            ? "bg-card border border-border text-foreground shadow-sm"
            : "bg-primary/10 border border-primary/20 text-foreground"
        }`}
      >
        <div
          className={`flex items-center justify-between gap-3 mb-2 pb-1.5 border-b ${
            isAdvisor ? "border-border/40" : "border-primary/20"
          }`}
        >
          <span className="font-serif text-xs font-semibold text-foreground">
            {isAdvisor ? "Danışman Profesör" : "Siz (Tez Yazarı)"}
          </span>
          {msg.createdAt && (
            <span className="font-mono text-xs text-muted-foreground">
              {msg.createdAt}
            </span>
          )}
        </div>

        <div className="text-sm">
          {isAdvisor ? (
            <div className="prose-sm max-w-none">
              {!msg.content && msg.isStreaming ? (
                <div className="flex items-center gap-1.5 py-1.5 px-0.5 text-muted-foreground">
                  <span className="size-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                  <span className="size-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                  <span className="size-2 rounded-full bg-primary animate-bounce" />
                </div>
              ) : (
                <>
                  <StreamingMarkdown
                    content={msg.content}
                    components={chatMarkdownComponents}
                  />
                  {msg.isStreaming && (
                    <span className="inline-block w-1.5 h-3.5 bg-primary ml-1 animate-pulse align-middle" />
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="whitespace-pre-wrap font-sans text-sm">
              {msg.content}
            </div>
          )}
        </div>

        {/* Action Bar for Advisor Messages */}
        {isAdvisor && msg.content && !msg.isStreaming && (
          <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenTaskDialog(msg.content)}
              className="h-7 text-xs px-2.5 rounded-md bg-secondary/40 hover:bg-secondary border-border text-foreground font-medium gap-1.5 cursor-pointer transition-colors"
              title="Bu düzeltmeyi Word'e uygulamak için Kanban panosuna görev aç"
            >
              <CheckSquare className="size-3.5 text-primary" />
              <span>Kanban Görevi Oluştur</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onCopy(msg.id, msg.content)}
              className="h-7 text-xs px-2 rounded-md text-muted-foreground hover:text-foreground cursor-pointer transition-colors gap-1"
              title="Metni Kopyala"
            >
              {isCopied ? (
                <>
                  <Check className="size-3 text-primary" />
                  <span className="text-primary text-xs font-medium">
                    Kopyalandı
                  </span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  <span className="text-xs">Kopyala</span>
                </>
              )}
            </Button>
          </div>
        )}

        {/* Action Bar for User Messages */}
        {!isAdvisor && msg.content && (
          <div className="mt-2 pt-1.5 border-t border-primary/20 flex items-center justify-end">
            <button
              type="button"
              onClick={() => onCopy(msg.id, msg.content)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
              title="Metni Kopyala"
            >
              {isCopied ? (
                <>
                  <Check className="size-3 text-primary" />
                  <span className="text-primary font-medium">Kopyalandı</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  <span>Kopyala</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {!isAdvisor && (
        <div className="size-8 rounded-md bg-secondary border border-border flex items-center justify-center text-secondary-foreground shrink-0 mt-0.5">
          <User className="size-4" />
        </div>
      )}
    </div>
  );
}
