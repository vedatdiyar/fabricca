"use client";

import { useState, useRef, useEffect, memo } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface AdvisorChatInputProps {
  onSendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
  disabled?: boolean;
}

/**
 * Sticky bottom input area for sending messages to the Thesis Advisor.
 *
 * @param props - Input form state and submit callback.
 * @returns Input form element.
 */
export const AdvisorChatInput = memo(function AdvisorChatInput({
  onSendMessage,
  isLoading,
  disabled = false,
}: AdvisorChatInputProps) {
  const [inputText, setInputText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const targetHeight = Math.min(Math.max(scrollHeight, 38), 140);
      textareaRef.current.style.height = `${targetHeight}px`;
      textareaRef.current.style.overflowY =
        scrollHeight > 140 ? "auto" : "hidden";
    }
  }, [inputText]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading || disabled) return;

    const message = inputText.trim();
    setInputText("");
    await onSendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-2.5 border-t border-border bg-card shrink-0 flex items-end gap-2"
    >
      <Textarea
        ref={textareaRef}
        rows={1}
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Aklınızdaki ham fikri, araştırma problemini veya sorularınızı yazın..."
        disabled={isLoading || disabled}
        className="textarea-academic text-sm leading-snug resize-none flex-1 min-h-[38px] max-h-[140px] py-2 px-3 overflow-hidden"
      />

      <Button
        type="submit"
        disabled={!inputText.trim() || isLoading || disabled}
        className="h-[38px] text-xs px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all [&_svg]:size-3.5 cursor-pointer shrink-0 inline-flex items-center gap-1.5 font-medium"
      >
        {isLoading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <>
            Gönder
            <Send className="size-3" />
          </>
        )}
      </Button>
    </form>
  );
});
