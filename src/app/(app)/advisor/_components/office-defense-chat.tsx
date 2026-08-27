"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createRevisionTaskAction } from "../office-actions";
import { CreateTaskDialog } from "./office/create-task-dialog";
import { OfficeDefenseEmptyState } from "./office/office-defense-empty-state";
import { OfficeDefenseMessageItem } from "./office/office-defense-message-item";
import type {
  JuryCritique,
  OfficeReviewReport,
} from "../_services/pipeline/types";

export interface DefenseMessage {
  id: string | number;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  isStreaming?: boolean;
}

export interface OfficeDefenseChatProps {
  outlineId?: number;
  outlineTitle?: string;
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
  outlineId,
  outlineTitle,
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [taskState, setTaskState] = useState({
    isOpen: false,
    title: "",
    description: "",
    isSaving: false,
  });

  // Auto-scroll only while the user is already at (or near) the bottom;
  // use instant scrolling during streaming to avoid animation restart jank.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distance =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distance > 160) return;
    messagesEndRef.current?.scrollIntoView({
      behavior: isStreaming ? "auto" : "smooth",
    });
  }, [messages, isStreaming]);

  // Adjust textarea height on change or reset
  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(Math.max(el.scrollHeight, 44), 140);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > 140 ? "auto" : "hidden";
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

  const handleOpenTaskDialog = (specificText?: string) => {
    let titleToUse = `Revizyon: ${(outlineTitle || "Tez Bölümü").slice(0, 40)}`;
    let descToUse = "";

    if (specificText && specificText.trim()) {
      descToUse = specificText.trim();
      if (activeCritique) {
        titleToUse = `Revizyon: ${activeCritique.title.slice(0, 40)}`;
      }
    } else if (activeCritique) {
      titleToUse = `Revizyon: ${activeCritique.title.slice(0, 40)}`;
      descToUse = `Jüri Şerhi: ${activeCritique.title}\n${activeCritique.critique}\n\nÖnerilen Çözüm: ${activeCritique.suggestedDefensePoint}`;
    } else {
      const lastAdvisorMsg = [...messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.content);
      descToUse =
        lastAdvisorMsg?.content?.trim() ||
        "Taslak metindeki editoryal ve metodolojik düzeltmeleri Word'e uygula.";
    }

    setTaskState({
      isOpen: true,
      title: titleToUse,
      description: descToUse,
      isSaving: false,
    });
  };

  const handleSaveTask = async () => {
    if (!taskState.title.trim()) return;
    setTaskState((prev) => ({ ...prev, isSaving: true }));
    try {
      const res = await createRevisionTaskAction({
        outlineId: outlineId || 0,
        title: taskState.title.trim(),
        description: taskState.description.trim() || undefined,
      });
      if (res.success) {
        toast.success("Revizyon görevi Kanban panosuna eklendi.");
        setTaskState((prev) => ({ ...prev, isOpen: false }));
      } else {
        toast.error(res.error || "Görev oluşturulamadı.");
      }
    } catch {
      toast.error("Görev oluşturulurken bir hata oluştu.");
    } finally {
      setTaskState((prev) => ({ ...prev, isSaving: false }));
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || isStreaming) return;
    const textToSend = inputText.trim();
    setInputText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
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
        "flex h-full flex-col min-h-0 bg-card rounded-lg border border-border overflow-hidden",
        className,
      )}
    >
      {/* Panel Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between p-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <MessageSquare className="size-4" />
            </div>
            <div>
              <h3 className="font-serif text-base font-semibold tracking-tight text-foreground">
                Danışmanla Canlı Müzakere Masası
              </h3>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">
                {hasStartedDefense
                  ? "Danışman hocanızla şerhleri ve savunma argümanlarınızı yüz yüze müzakere edin."
                  : "Sol paneldeki şerhleri inceledikten sonra oturumu başlatın."}
              </p>
            </div>
          </div>

          {activeCritique && (
            <span className="text-xs px-2 py-0.5 rounded-md bg-warning/10 text-warning border border-warning/20 font-medium truncate max-w-[200px]">
              Odak: {activeCritique.title}
            </span>
          )}
        </div>
      )}

      {/* Messages Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {!hasStartedDefense ? (
          <OfficeDefenseEmptyState
            activeCritique={activeCritique}
            onStartDefense={onStartDefense}
          />
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <OfficeDefenseMessageItem
                key={msg.id}
                msg={msg}
                isCopied={copiedId === msg.id}
                onCopy={handleCopy}
                onOpenTaskDialog={handleOpenTaskDialog}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Form */}
      {hasStartedDefense && (
        <div className="p-3 border-t border-border bg-card shrink-0">
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
              placeholder="Savunma argümanınızı veya cevabınızı yazın..."
              className="min-h-[44px] max-h-[140px] text-sm p-2.5 bg-background border border-border resize-none leading-relaxed flex-1 rounded-md text-foreground placeholder:text-muted-foreground"
              rows={1}
            />

            <Button
              type="button"
              onClick={handleSend}
              disabled={!inputText.trim() || isStreaming}
              className="h-[44px] w-[44px] p-0 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 cursor-pointer flex items-center justify-center mb-0"
              title="Gönder"
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

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={taskState.isOpen}
        onOpenChange={(open) =>
          setTaskState((prev) => ({ ...prev, isOpen: open }))
        }
        taskTitle={taskState.title}
        onChangeTaskTitle={(title) =>
          setTaskState((prev) => ({ ...prev, title }))
        }
        taskDescription={taskState.description}
        onChangeTaskDescription={(description) =>
          setTaskState((prev) => ({ ...prev, description }))
        }
        onSave={handleSaveTask}
        isSaving={taskState.isSaving}
      />
    </div>
  );
}
