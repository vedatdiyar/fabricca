"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

interface AdvisorChatInputProps {
  disabled?: boolean;
  onSend: (message: string) => void;
}

/**
 * Self-contained message composer for the advisor chat. Owns the draft text,
 * the auto-resizing textarea and the send button, and only communicates
 * outwards through the onSend event.
 *
 * @param root0 - Component props.
 * @param root0.disabled - Whether sending is disabled while the assistant replies.
 * @param root0.onSend - Callback invoked with the trimmed message to send.
 * @returns The chat input composer markup.
 */
export function AdvisorChatInput({
  disabled = false,
  onSend,
}: AdvisorChatInputProps) {
  const [inputQuery, setInputQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [inputQuery]);

  useEffect(() => {
    const resize = () => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const handleSend = () => {
    const message = inputQuery.trim();
    if (!message || disabled) return;
    onSend(message);
    setInputQuery("");
  };

  return (
    <div className="mt-4 p-2 bg-card border border-border/40 rounded-lg flex items-end space-x-2">
      <textarea
        ref={textareaRef}
        aria-label="Akademik danışmanınıza soracağınız soru"
        value={inputQuery}
        onChange={(e) => setInputQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="Akademik danışmanınıza kütüphaneniz veya tez yapınızla ilgili bir soru sorun..."
        rows={1}
        className="flex-1 p-3 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none overflow-y-auto max-h-50 min-h-11"
      />

      <button
        type="button"
        aria-label="Soruyu gönder"
        onClick={handleSend}
        disabled={disabled || !inputQuery.trim()}
        className="p-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}
