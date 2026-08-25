"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  Swords,
  User,
  GraduationCap,
  MessageSquare,
  Copy,
  Check,
  BookmarkPlus,
  CheckSquare,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  saveDefenseNoteAction,
  createRevisionTaskAction,
} from "../office-actions";
import { SaveNoteDialog } from "./office/save-note-dialog";
import { CreateTaskDialog } from "./office/create-task-dialog";
import type {
  JuryCritique,
  OfficeReviewReport,
} from "../_services/pipeline/types";

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
  report,
  className,
  hideHeader = false,
  onSendMessage,
  onStartDefense,
}: OfficeDefenseChatProps) {
  const [inputText, setInputText] = useState("");
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Dialog States
  const [noteState, setNoteState] = useState({
    isOpen: false,
    content: "",
    isSaving: false,
  });

  const [taskState, setTaskState] = useState({
    isOpen: false,
    title: "",
    description: "",
    isSaving: false,
  });

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  const handleOpenNoteDialog = (specificText?: string) => {
    let contentToUse = specificText;
    if (!contentToUse) {
      const lastAdvisorMsg = [...messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.content);
      contentToUse = lastAdvisorMsg?.content;
    }

    const defaultContent = contentToUse?.trim()
      ? `Danışman Müzakere Kararı (${outlineTitle || "Tez Bölümü"}):\n${contentToUse.trim()}`
      : report?.diff?.polished
        ? `Taslak İnceleme Notu (${outlineTitle || "Tez Bölümü"}):\n${report.diff.polished}\n\nÖnemli Şerh:\n${
            report.juryCritiques?.[0]?.critique || ""
          }`
        : `Müzakere Notu (${outlineTitle || "Tez Bölümü"})`;

    setNoteState({
      isOpen: true,
      content: defaultContent,
      isSaving: false,
    });
  };

  const handleSaveNote = async () => {
    if (!noteState.content.trim()) return;
    setNoteState((prev) => ({ ...prev, isSaving: true }));
    try {
      const res = await saveDefenseNoteAction({
        outlineId: outlineId || 0,
        noteContent: noteState.content.trim(),
      });
      if (res.success) {
        toast.success(
          "Savunma notu Alıntı Fişleri ve Bölüme başarıyla kaydedildi.",
        );
        setNoteState((prev) => ({ ...prev, isOpen: false }));
      } else {
        toast.error(res.error || "Not kaydedilemedi.");
      }
    } catch {
      toast.error("Not kaydedilirken bir hata oluştu.");
    } finally {
      setNoteState((prev) => ({ ...prev, isSaving: false }));
    }
  };

  const handleOpenTaskDialog = (specificText?: string) => {
    const primaryCritique = activeCritique || report?.juryCritiques?.[0];
    let contentToUse = specificText;
    if (!contentToUse) {
      const lastAdvisorMsg = [...messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.content);
      contentToUse = lastAdvisorMsg?.content;
    }

    const textTrimmed = contentToUse?.trim();
    const defaultDesc = primaryCritique
      ? `Jüri Şerhi: ${primaryCritique.title}\n${primaryCritique.critique}\n\nÖnerilen Çözüm: ${primaryCritique.suggestedDefensePoint}${
          textTrimmed ? `\n\nDanışman Kararı: ${textTrimmed}` : ""
        }`
      : textTrimmed || "Taslak metindeki editoryal ve sayfa düzeltmelerini Word'e uygula.";

    setTaskState({
      isOpen: true,
      title: `Revizyon: ${(outlineTitle || "Tez Bölümü").slice(0, 40)}`,
      description: defaultDesc,
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!hasStartedDefense ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
            <div className="size-10 rounded-md bg-primary/10 text-primary mb-3 border border-primary/20 flex items-center justify-center">
              <Swords className="size-5" />
            </div>
            <h4 className="font-serif text-sm font-semibold tracking-tight text-foreground mb-1">
              Danışmanın Kapısını Çalın
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Sol paneldeki kenar notlarını ve jüri şerhlerini inceledikten
              sonra savunma oturumunu başlatın. Danışmanınız en kritik itiraz
              noktasını masaya getirecektir.
            </p>
            <Button
              onClick={() => onStartDefense(activeCritique || undefined)}
              className="h-8 text-xs px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium gap-1.5 cursor-pointer"
            >
              <Swords className="size-3.5" />
              <span>Savunmaya Başla (Müzakereyi Aç)</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isAdvisor = msg.role === "assistant";
              const isCopied = copiedId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${
                    isAdvisor ? "justify-start" : "justify-end"
                  }`}
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
                      <div className="flex items-center gap-1.5">
                        {msg.createdAt && (
                          <span className="font-mono text-xs text-muted-foreground mr-0.5">
                            {msg.createdAt}
                          </span>
                        )}
                        <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5 bg-background/90 backdrop-blur-sm border border-border/40 rounded-md p-0.5">
                          {isAdvisor && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenNoteDialog(msg.content)}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                title="Bu kararı Alıntı Fişi / Bölüm Notu olarak kaydet"
                              >
                                <BookmarkPlus className="size-3 text-primary" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenTaskDialog(msg.content)}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                title="Bu tespiti Word'de düzeltmek için Kanban görevi aç"
                              >
                                <CheckSquare className="size-3 text-primary" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            title="Metni Kopyala"
                          >
                            {isCopied ? (
                              <Check className="size-3 text-primary" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </div>
                      </div>
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
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={chatMarkdownComponents}
                              >
                                {msg.content}
                              </ReactMarkdown>
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
                  </div>

                  {!isAdvisor && (
                    <div className="size-8 rounded-md bg-secondary border border-border flex items-center justify-center text-secondary-foreground shrink-0 mt-0.5">
                      <User className="size-4" />
                    </div>
                  )}
                </div>
              );
            })}

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
              className="min-h-[44px] max-h-[140px] text-xs p-2.5 bg-background border border-border resize-none leading-relaxed flex-1 rounded-md text-foreground placeholder:text-muted-foreground"
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

      {/* Save Note Dialog */}
      <SaveNoteDialog
        open={noteState.isOpen}
        onOpenChange={(open) =>
          setNoteState((prev) => ({ ...prev, isOpen: open }))
        }
        outlineTitle={outlineTitle || "Tez Bölümü"}
        noteContent={noteState.content}
        onChangeNoteContent={(content) =>
          setNoteState((prev) => ({ ...prev, content }))
        }
        onSave={handleSaveNote}
        isSaving={noteState.isSaving}
      />

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

