"use client";

import { Check, Copy, User, GraduationCap, BookOpen } from "lucide-react";
import { MarkdownRenderer } from "./markdown-renderer";
import { ToolConfirmationCard } from "./tool-confirmation-card";
import type { Message } from "../_lib/types";

/**
 * Renders the persona badge pill shown above advisor messages.
 *
 * @param root0 - Component props.
 * @param root0.persona - The message persona.
 * @returns The persona badge markup.
 */
export function PersonaBadge({
  persona,
}: {
  persona?: "SOCRATIC_ADVISOR" | "TEZ_ASSISTANT";
}) {
  if (persona === "SOCRATIC_ADVISOR") {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 mb-2.5 shadow-xs">
        <GraduationCap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>Akademik Danışman</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 mb-2.5 shadow-xs">
      <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
      <span>Tez Asistanı</span>
    </div>
  );
}

interface ChatMessageItemProps {
  msg: Message;
  copiedMessageId: string | null;
  onCopyMessage: (messageId: string, content: string) => void;
  onCitationClick: (messageId: string, sourceIndex: number) => void;
  onApproveToolCall: (
    toolCallId: string,
    name: string,
    args: Record<string, unknown>,
  ) => Promise<void>;
  onRejectToolCall: (toolCallId: string) => void;
  onUndoToolCall: (
    toolCallId: string,
    name: string,
    args: Record<string, unknown>,
    executionResult?: unknown,
    previousState?: Record<string, unknown>,
  ) => Promise<void>;
}

/**
 * Renders a single chat message with its avatar, persona badge, markdown body,
 * pending tool calls, copy action and timestamp.
 *
 * @param root0 - Component props.
 * @param root0.msg - The message to render.
 * @param root0.copiedMessageId - Id of the message currently showing a copied indicator.
 * @param root0.onCopyMessage - Callback invoked when the copy button is clicked.
 * @param root0.onCitationClick - Callback invoked when a citation badge is clicked.
 * @param root0.onApproveToolCall - Callback to approve a pending tool call.
 * @param root0.onRejectToolCall - Callback to reject a pending tool call.
 * @param root0.onUndoToolCall - Callback to undo an executed tool call.
 * @returns The single message markup.
 */
export function ChatMessageItem({
  msg,
  copiedMessageId,
  onCopyMessage,
  onCitationClick,
  onApproveToolCall,
  onRejectToolCall,
  onUndoToolCall,
}: ChatMessageItemProps) {
  const isUser = msg.role === "user";
  const isSocratic = msg.persona === "SOCRATIC_ADVISOR";
  const isCopied = copiedMessageId === msg.id;

  return (
    <div
      className={`flex space-x-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 overflow-hidden transition-all ${
            isSocratic
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/40"
              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/40"
          }`}
        >
          {isSocratic ? (
            <GraduationCap className="w-4 h-4" />
          ) : (
            <BookOpen className="w-4 h-4" />
          )}
        </div>
      )}

      <div
        className={`space-y-2 ${isUser ? "items-end max-w-3xl" : "items-start flex-1 max-w-4xl"}`}
      >
        <div
          className={`p-4 rounded-md text-sm leading-relaxed transition-all ${
            isUser
              ? "bg-primary/10 border border-primary/20 text-foreground rounded-tr-none"
              : isSocratic
                ? "bg-amber-500/5 dark:bg-amber-500/10 border-2 border-amber-500/40 dark:border-amber-400/40 text-card-foreground rounded-tl-none shadow-sm"
                : "bg-emerald-500/5 dark:bg-emerald-500/10 border-2 border-emerald-500/30 dark:border-emerald-400/30 text-card-foreground rounded-tl-none shadow-sm"
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{msg.content}</div>
          ) : (
            <>
              <PersonaBadge persona={msg.persona} />
              <MarkdownRenderer
                content={msg.content}
                sources={msg.sources}
                onCitationClick={(sourceIndex) =>
                  onCitationClick(msg.id, sourceIndex)
                }
              />

              {msg.toolCalls?.map((tc) => (
                <ToolConfirmationCard
                  key={tc.toolCallId}
                  toolCall={tc}
                  onApprove={onApproveToolCall}
                  onReject={onRejectToolCall}
                  onUndo={onUndoToolCall}
                />
              ))}
            </>
          )}

          <div className="flex items-center justify-between mt-2">
            <button
              type="button"
              aria-label="Mesajı kopyala"
              onClick={() => onCopyMessage(msg.id, msg.content)}
              className="transition-colors text-muted-foreground hover:text-foreground"
            >
              {isCopied ? (
                <Check
                  className={`w-3.5 h-3.5 ${isUser ? "text-primary" : "text-success"}`}
                />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            <div
              className={`text-[10px] text-muted-foreground ${isUser ? "ml-auto" : ""}`}
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
}
