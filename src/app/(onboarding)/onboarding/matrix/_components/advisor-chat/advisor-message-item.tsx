"use client";

import { useEffect, useRef, memo } from "react";
import { Copy, Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatMessage } from "../advisor-chat";
import { AdvisorMarkdown, cleanAdvisorMessageText } from "./advisor-markdown";

interface AdvisorMessageItemProps {
  msg: ChatMessage;
  isEditing: boolean;
  editDraft: string;
  onSetEditDraft: (text: string) => void;
  onStartEdit: (msg: ChatMessage) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onCopy: (id: string, text: string) => void;
  copiedId: string | null;
  isLoading: boolean;
  streamingText?: string;
  onEditSubmit?: (
    messageId: string,
    newContent: string,
  ) => Promise<void> | void;
}

/**
 * Renders a single conversation bubble with inline editing, copying, and markdown support.
 *
 * @param props - Message item state and action callbacks.
 * @returns Message bubble element.
 */
export const AdvisorMessageItem = memo(function AdvisorMessageItem({
  msg,
  isEditing,
  editDraft,
  onSetEditDraft,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onCopy,
  copiedId,
  isLoading,
  streamingText = "",
  onEditSubmit,
}: AdvisorMessageItemProps) {
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isModel = msg.role === "model";

  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.style.height = "auto";
      const scrollHeight = editTextareaRef.current.scrollHeight;
      editTextareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 100), 320)}px`;
      editTextareaRef.current.focus({ preventScroll: true });
    }
  }, [isEditing, editDraft]);

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancelEdit();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSaveEdit();
    }
  };

  if (isEditing) {
    return (
      <div className="w-full my-2 p-4 rounded-lg bg-card border border-primary/30 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-primary flex items-center gap-1.5">
            <Pencil className="size-3" />
            Mesajınızı Düzenleyin
          </span>
        </div>
        <Textarea
          ref={editTextareaRef}
          value={editDraft}
          onChange={(e) => {
            onSetEditDraft(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(Math.max(e.target.scrollHeight, 100), 320)}px`;
          }}
          onKeyDown={handleEditKeyDown}
          rows={4}
          className="textarea-academic text-sm leading-relaxed resize-none w-full min-h-[100px] max-h-[320px] p-3"
          placeholder="Mesajınızı düzenleyin..."
        />
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancelEdit}
            className="h-8 text-xs px-3 rounded-md"
          >
            <X className="size-3.5 mr-1.5" />
            İptal
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!editDraft.trim() || isLoading}
            onClick={onSaveEdit}
            className="h-8 text-xs px-3.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Check className="size-3.5 mr-1.5" />
            Güncelle ve Yanıtı Yenile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isModel ? "justify-start" : "justify-end"}`}>
      <div
        className={`flex flex-col gap-1 max-w-[85%] sm:max-w-[80%] ${
          isModel ? "items-start" : "items-end"
        }`}
      >
        <div
          className={`w-full rounded-lg p-3.5 ${
            isModel
              ? "bg-secondary/40 border border-border text-foreground"
              : "bg-primary/10 border border-primary/20 text-foreground"
          }`}
        >
          {isModel ? (
            <div className="space-y-2.5 text-sm font-normal leading-relaxed font-sans text-foreground">
              <AdvisorMarkdown content={msg.content} />
            </div>
          ) : (
            <p className="text-sm font-normal leading-relaxed font-sans whitespace-pre-wrap text-foreground">
              {msg.content}
            </p>
          )}
        </div>
        {!isEditing && msg.content && msg.id !== "welcome-1" && (
          <div className="flex items-center gap-1">
            {!isModel && onEditSubmit && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isLoading || !!streamingText}
                onClick={() => onStartEdit(msg)}
                className="size-6 rounded-md shrink-0 text-muted-foreground hover:text-foreground hover:bg-secondary/60 [&_svg]:size-3"
                title="Düzenle"
                aria-label="Mesajı düzenle"
              >
                <Pencil />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                onCopy(msg.id, cleanAdvisorMessageText(msg.content))
              }
              className="size-6 rounded-md shrink-0 text-muted-foreground hover:text-foreground hover:bg-secondary/60 [&_svg]:size-3"
              title="Metni kopyala"
              aria-label="Metni kopyala"
            >
              {copiedId === msg.id ? (
                <Check className="text-primary" />
              ) : (
                <Copy />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});
