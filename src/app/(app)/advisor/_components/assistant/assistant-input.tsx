"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AssistantInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Text prompt input bar for the academic thesis assistant.
 *
 * @param props - Component props.
 * @param props.onSend - Callback invoked when a message is submitted.
 * @param props.isLoading - Whether a response is currently generating.
 * @param props.disabled - Whether the input is disabled.
 * @param props.placeholder - Optional placeholder text.
 * @returns The rendered input bar markup.
 */
export function AssistantInput({
  onSend,
  isLoading,
  disabled = false,
  placeholder = "Teziniz, metodolojiniz veya kütüphane kaynaklarınız hakkında bir soru sorun...",
}: AssistantInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isLoading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLoading]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [text]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || disabled) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <div className="border-t border-border bg-card/80 p-3.5 backdrop-blur-sm shrink-0">
      <div className="flex items-end gap-2 rounded-lg border border-border bg-background p-1.5 pl-3.5 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-xs">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading || disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-hidden disabled:opacity-50 min-h-[28px] max-h-40 overflow-y-auto"
        />

        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={!text.trim() || isLoading || disabled}
          className="size-7 p-0 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 cursor-pointer transition-all shrink-0 shadow-xs flex items-center justify-center mb-0.5"
          title="Gönder"
          aria-label="Gönder"
        >
          {isLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ArrowUp className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
