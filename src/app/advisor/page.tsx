"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  GraduationCap,
  Send,
  Sparkles,
  BookOpen,
  Check,
  Star,
  Loader2,
  Filter,
  X,
  Clock,
  ArrowRight,
  Info,
  Trash2,
  FileText,
  HelpCircle,
} from "lucide-react";
import {
  getLibraryReferencesAction,
  sendMessageAction,
  saveInsightAction,
  ReferenceItem,
  ChatMessage,
  CitationSource,
} from "./actions";

interface ChatMessageWithMetadata {
  role: "user" | "assistant" | "model";
  content: string;
  sources?: CitationSource[];
  timestamp: string;
}

export default function AdvisorPage() {
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [selectedRefIds, setSelectedRefIds] = useState<number[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessageWithMetadata[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Notification / Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [savedInsightIds, setSavedInsightIds] = useState<Set<number>>(
    new Set(),
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isPending]);

  // Load references and localStorage on mount
  useEffect(() => {
    async function initPage() {
      // 1. Load references
      try {
        setLoadingRefs(true);
        const res = await getLibraryReferencesAction();
        if (res.success && res.references) {
          setReferences(res.references);
        }
      } catch (err) {
        console.error("Failed to load references:", err);
      } finally {
        setLoadingRefs(false);
      }

      // 2. Load persistent chat history from localStorage
      const saved = localStorage.getItem("fabricca_chat_history");
      if (saved) {
        try {
          setChatHistory(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse chat history:", e);
          loadDefaultWelcomeMessage();
        }
      } else {
        loadDefaultWelcomeMessage();
      }
    }

    initPage();
  }, []);

  // Save chatHistory to localStorage on change
  useEffect(() => {
    if (chatHistory.length > 0 && chatHistory[0].timestamp !== "") {
      localStorage.setItem(
        "fabricca_chat_history",
        JSON.stringify(chatHistory),
      );
    }
  }, [chatHistory]);

  // Dynamically adjust textarea height based on typing
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [inputValue]);

  const loadDefaultWelcomeMessage = () => {
    setChatHistory([
      {
        role: "assistant",
        content:
          "Hoş geldiniz sevgili meslektaşım. Burası **Dijital Danışman Odası**.\n\n" +
          "Tez çalışmanızın hangi aşamasındasınız? Kütüphanenizdeki makaleleri sol panelden seçerek doğrudan bu kaynaklara yönelik **RAG destekli semantik sorular** sorabilir ya da genel sosyal teoriler (Marx, Foucault, biopolitika, finansallaşma vb.), araştırma yöntemleri ve tez kurgusu üzerine doğrudan **kuramsal/metodolojik tartışmalar** yürütebiliriz.\n\n" +
          "Size nasıl yardımcı olabilirim?",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
  };

  // Show a temporary toast notification
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Toggle selected reference IDs
  const handleToggleRef = (id: number) => {
    setSelectedRefIds((prev) =>
      prev.includes(id) ? prev.filter((refId) => refId !== id) : [...prev, id],
    );
  };

  const handleSelectAllRefs = () => {
    setSelectedRefIds(references.map((r) => r.id));
  };

  const handleClearAllRefs = () => {
    setSelectedRefIds([]);
  };

  // Clear chat history permanently
  const handleClearChatHistory = () => {
    if (confirm("Sohbet geçmişini tamamen silmek istediğinize emin misiniz?")) {
      localStorage.removeItem("fabricca_chat_history");
      setSavedInsightIds(new Set());
      loadDefaultWelcomeMessage();
      showToast("Sohbet geçmişi temizlendi.");
    }
  };

  // Send message handler
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isPending) return;

    const userMessageText = inputValue.trim();
    const currentTime = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    // 1. Add user message locally
    const updatedHistory = [
      ...chatHistory,
      {
        role: "user" as const,
        content: userMessageText,
        timestamp: currentTime,
      },
    ];
    setChatHistory(updatedHistory);
    setInputValue("");
    setIsPending(true);

    // 2. Map history to server action format (without local frontend metadata like timestamp)
    const serverHistory: ChatMessage[] = updatedHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // 3. Trigger Server Action
    try {
      const res = await sendMessageAction(
        userMessageText,
        serverHistory,
        selectedRefIds,
      );
      if (res.success && res.response) {
        setChatHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.response!,
            sources: res.sources,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
      } else {
        showToast(res.error || "Hoca yanıt veremedi, bir sorun oluştu.");
      }
    } catch (err: any) {
      showToast("Sunucu hatası: Mesaj iletilemedi.");
    } finally {
      setIsPending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Save brilliant insight into Fikir Sepeti
  const handleSaveInsight = async (text: string, messageIndex: number) => {
    if (savedInsightIds.has(messageIndex)) {
      showToast("Bu öngörü zaten fikir sepetinizde bulunuyor.");
      return;
    }

    try {
      const res = await saveInsightAction(text);
      if (res.success) {
        setSavedInsightIds((prev) => {
          const next = new Set(prev);
          next.add(messageIndex);
          return next;
        });
        showToast(
          "Parlak fikir başarıyla fikir sepetine (Insights) eklendi! ✨",
        );
      } else {
        showToast(res.error || "Fikir kaydedilemedi.");
      }
    } catch (err) {
      showToast("Bağlantı hatası: Fikir kaydedilemedi.");
    }
  };

  // Interactive Inline Citation Popover (hover to open, click to lock)
  function CitationPopover({
    chunkDbId,
    sources,
  }: {
    chunkDbId: number;
    sources?: CitationSource[];
  }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [coords, setCoords] = useState<{
      top: number;
      left: number;
      isNearTop: boolean;
    } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    const source = sources?.find((s) => s.id === chunkDbId);

    const updatePosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const isNearTop = rect.top < 220;
        setCoords({
          top: isNearTop ? rect.bottom + 6 : rect.top - 6,
          left: rect.left + rect.width / 2,
          isNearTop,
        });
      }
    };

    const handleClose = () => {
      setIsOpen(false);
      setIsLocked(false);
    };

    useEffect(() => {
      if (isOpen) {
        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
      }
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }, [isOpen]);

    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (
          popoverRef.current &&
          !popoverRef.current.contains(event.target as Node) &&
          buttonRef.current &&
          !buttonRef.current.contains(event.target as Node)
        ) {
          handleClose();
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!source) {
      return <span className="text-primary font-bold">[{chunkDbId}]</span>;
    }

    const sourceIndex = sources
      ? sources.findIndex((s) => s.id === chunkDbId)
      : -1;
    const displayIndex = sourceIndex !== -1 ? sourceIndex + 1 : chunkDbId;

    let leftPos = coords ? coords.left : 0;
    if (coords && typeof window !== "undefined") {
      const popoverWidth = 320;
      const padding = 16;
      const minLeft = popoverWidth / 2 + padding;
      const maxLeft = window.innerWidth - popoverWidth / 2 - padding;
      leftPos = Math.max(minLeft, Math.min(leftPos, maxLeft));
    }

    return (
      <span className="inline-block align-baseline select-none">
        <button
          ref={buttonRef}
          type="button"
          onMouseEnter={() => {
            if (!isLocked) setIsOpen(true);
            updatePosition();
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (isLocked) {
              handleClose();
            } else {
              setIsLocked(true);
              setIsOpen(true);
            }
          }}
          className="mx-0.5 px-1 py-0.2 bg-muted hover:bg-primary border border-border hover:border-primary text-primary hover:text-primary-foreground font-mono text-[9px] font-bold rounded cursor-pointer transition select-none active:scale-95 duration-100"
        >
          {displayIndex}
        </button>

        {isOpen &&
          coords &&
          typeof window !== "undefined" &&
          createPortal(
            <div
              ref={popoverRef}
              onMouseLeave={() => {
                if (!isLocked) handleClose();
              }}
              style={{
                position: "fixed",
                top: `${coords.top}px`,
                left: `${leftPos}px`,
                transform: coords.isNearTop
                  ? "translate(-50%, 0)"
                  : "translate(-50%, -100%)",
                width: "320px",
                maxWidth: "calc(100vw - 32px)",
                zIndex: 9999,
              }}
              className="bg-card border border-primary p-4 rounded-lg shadow-2xl text-foreground text-left block cursor-default animate-fade-in select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="flex items-center justify-between border-b border-border pb-1.5 mb-2 shrink-0">
                <span className="font-extrabold text-[10px] uppercase text-primary tracking-wider truncate max-w-[180px] flex items-center gap-1.5 font-sans">
                  <FileText className="size-3 text-primary shrink-0" />
                  {source.title}
                </span>
                <span className="text-[9px] bg-muted px-2 py-0.5 rounded text-primary font-mono select-none">
                  {(source.score * 100).toFixed(0)}% Eşleşme
                </span>
                {isLocked && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClose();
                    }}
                    className="ml-2 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-border transition-colors"
                    aria-label="Kapat"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </span>
              <span className="text-[11px] leading-relaxed text-muted-foreground block max-h-40 overflow-y-auto select-text font-sans font-medium pr-1 [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:pl-6 [&_ol]:my-2">
                {source.content}
              </span>
            </div>,
            document.body,
          )}
      </span>
    );
  }

  // Pre-formatter to convert standard [^1] style markdown citations to markdown links: [1](citation-1)
  const formatCitationLinks = (content: string) => {
    return content.replace(/\[\^(\d+)\]/g, "[$1](citation-$1)");
  };

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground p-4 md:p-8 h-screen overflow-hidden relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-6 right-6 z-50 bg-card border border-primary text-primary px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-fade-in font-sans text-xs font-semibold select-none">
          <Sparkles className="size-4 text-primary animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Area */}
      <header className="border-b border-border pb-4 mb-6 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight font-sans text-foreground">
            Dijital Danışman Odası
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-sans">
            NotebookLM kalitesinde, dipnot atıflı RAG asistan motoru ve akademik
            chat paneli
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mobile Filter Button */}
          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            className="md:hidden flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-lg text-xs font-semibold text-foreground hover:bg-accent hover:border-accent-foreground transition"
          >
            <Filter className="size-3.5 text-primary" />
            <span>Kaynaklar ({selectedRefIds.length})</span>
          </button>

          {/* Clear History Button */}
          {chatHistory.length > 1 && (
            <button
              onClick={handleClearChatHistory}
              title="Sohbeti Temizle"
              className="bg-card border border-border hover:border-destructive hover:text-destructive px-3 py-1.5 rounded-lg text-xs font-semibold text-foreground transition flex items-center gap-2"
            >
              <Trash2 className="size-3.5" />
              <span className="hidden sm:inline">Sohbeti Temizle</span>
            </button>
          )}

          <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-sans font-bold uppercase tracking-wider text-primary bg-card border border-border px-3 py-1 rounded">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            RAG ACTIVE
          </span>
        </div>
      </header>

      {/* Workspace Area */}
      <div className="flex-1 flex gap-6 overflow-hidden min-h-0 mb-4">
        {/* LEFT SIDEBAR: Discussion Reference Library (Desktop: 1/4 width) */}
        <aside className="hidden md:flex flex-col w-72 bg-card border border-border rounded-xl p-5 shadow-lg overflow-hidden shrink-0">
          <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <BookOpen className="size-3.5 text-primary" />
              Tartışma Kaynakları
            </h2>
            {references.length > 0 && (
              <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground font-mono">
                {selectedRefIds.length}/{references.length}
              </span>
            )}
          </div>

          {loadingRefs ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2">
              <Loader2 className="size-6 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground font-sans">
                Referanslar yükleniyor...
              </p>
            </div>
          ) : references.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-border rounded-lg bg-background">
              <Info className="size-6 text-muted-foreground mb-2" />
              <h3 className="text-xs font-bold text-foreground">
                Kütüphaneniz Boş
              </h3>
              <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                RAG araması yapmak için öncelikle Kütüphane sayfasından
                araştırma makalelerinizi (PDF) yükleyin.
              </p>
              <a
                href="/library"
                className="mt-4 flex items-center gap-1 bg-muted hover:bg-accent border border-border px-3 py-1 rounded text-[10px] font-bold text-foreground transition animate-pulse"
              >
                Kütüphaneye Git
                <ArrowRight className="size-3 text-primary" />
              </a>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex gap-2 mb-3">
                <button
                  onClick={handleSelectAllRefs}
                  className="flex-1 bg-muted hover:bg-accent border border-border py-1.5 rounded text-[9px] font-bold text-foreground transition"
                >
                  Tümünü Seç
                </button>
                <button
                  onClick={handleClearAllRefs}
                  className="flex-1 bg-muted hover:bg-accent border border-border py-1.5 rounded text-[9px] font-bold text-foreground transition"
                >
                  Seçimi Kaldır
                </button>
              </div>

              {/* Scrollable list of references */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {references.map((ref) => {
                  const isChecked = selectedRefIds.includes(ref.id);
                  return (
                    <div
                      key={ref.id}
                      onClick={() => handleToggleRef(ref.id)}
                      className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer select-none transition duration-100 ${
                        isChecked
                          ? "bg-muted border-primary"
                          : "bg-background border-border hover:border-muted-foreground"
                      }`}
                    >
                      <div
                        className={`mt-0.5 size-4 rounded border flex items-center justify-center shrink-0 transition ${
                          isChecked
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border bg-card"
                        }`}
                      >
                        {isChecked && <Check className="size-3 stroke-[3]" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-foreground truncate">
                          {ref.title}
                        </h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {ref.authors || "Bilinmeyen Yazar"}
                          {ref.year ? ` • ${ref.year}` : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-border pt-3 mt-3 shrink-0">
                <p className="text-[10px] text-muted-foreground leading-normal font-sans">
                  Soru sorduğunuzda semantik RAG taraması{" "}
                  <strong>yalnızca seçili</strong> makaleler üzerinde çalışır.
                  Hiçbiri seçilmezse genel kuramsal/metodolojik asistan modu
                  aktifleşir.
                </p>
              </div>
            </div>
          )}
        </aside>

        {/* RIGHT CHAT AREA: Academic RAG Chat */}
        <main className="flex-1 flex flex-col bg-card border border-border rounded-xl shadow-lg overflow-hidden relative">
          {/* Chat Messages Log */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
            {chatHistory.map((msg, index) => {
              const isAssistant =
                msg.role === "assistant" || msg.role === "model";
              return (
                <div
                  key={index}
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
                      className={`p-4 rounded-xl shadow border transition duration-150 ${
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
                              p: ({ children }) => (
                                <p className="text-sm leading-relaxed text-foreground select-text font-sans mb-3 last:mb-0">
                                  {children}
                                </p>
                              ),
                              h1: ({ children }) => (
                                <h2 className="text-lg font-black text-primary mt-8 mb-4 border-b border-primary/20 pb-2 select-text font-sans">
                                  {children}
                                </h2>
                              ),
                              h2: ({ children }) => (
                                <h3 className="text-base font-extrabold text-primary mt-6 mb-3 border-b border-border pb-1 select-text font-sans">
                                  {children}
                                </h3>
                              ),
                              h3: ({ children }) => (
                                <h4 className="text-sm font-bold text-primary mt-4 mb-2 select-text font-sans">
                                  {children}
                                </h4>
                              ),
                              ul: ({ children }) => (
                                <ul className="list-disc pl-5 text-sm leading-relaxed text-foreground select-text my-1.5 font-sans space-y-1">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="list-decimal pl-5 text-sm leading-relaxed text-foreground select-text my-1.5 font-sans space-y-1">
                                  {children}
                                </ol>
                              ),
                              li: ({ children }) => (
                                <li className="pl-0.5 my-0.5 text-sm leading-relaxed text-foreground select-text font-sans">
                                  {children}
                                </li>
                              ),
                              pre: ({ children }) => (
                                <pre className="bg-background border border-border p-4 rounded-lg my-4 font-mono text-xs overflow-x-auto text-primary">
                                  {children}
                                </pre>
                              ),
                              code: ({ children, className }) => {
                                const match = /language-(\w+)/.exec(
                                  className || "",
                                );
                                return match ? (
                                  <code className="text-primary font-mono text-xs block">
                                    {children}
                                  </code>
                                ) : (
                                  <code className="bg-background text-primary px-1.5 py-0.5 rounded font-mono text-xs border border-border select-text">
                                    {children}
                                  </code>
                                );
                              },
                              table: ({ children }) => (
                                <div className="overflow-x-auto my-4 border border-border rounded-lg max-w-full">
                                  <table className="w-full text-left border-collapse text-xs select-text">
                                    {children}
                                  </table>
                                </div>
                              ),
                              thead: ({ children }) => (
                                <thead className="bg-background text-foreground font-bold border-b border-border">
                                  {children}
                                </thead>
                              ),
                              tbody: ({ children }) => (
                                <tbody>{children}</tbody>
                              ),
                              tr: ({ children }) => (
                                <tr className="border-b border-border hover:bg-muted/30 transition">
                                  {children}
                                </tr>
                              ),
                              th: ({ children }) => (
                                <th className="p-3 font-semibold text-primary">
                                  {children}
                                </th>
                              ),
                              td: ({ children }) => (
                                <td className="p-3 text-foreground font-medium">
                                  {children}
                                </td>
                              ),
                              a: ({ href, children }) => {
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
                            onClick={() =>
                              handleSaveInsight(msg.content, index)
                            }
                            disabled={savedInsightIds.has(index)}
                            className={`flex items-center gap-1 border px-2 py-0.5 rounded transition ${
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
                  </div>
                </div>
              );
            })}

            {/* Danışman Düşünüyor (Loading response state) */}
            {isPending && (
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

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Textarea Box Container */}
          <div className="border-t border-border p-4 bg-card shrink-0 select-none">
            <div className="max-w-4xl mx-auto flex items-end bg-background border border-border rounded-lg p-1.5 focus-within:border-primary transition duration-150">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={
                  isPending
                    ? "Danışman yanıtı hazırlıyor..."
                    : selectedRefIds.length > 0
                      ? `Seçili ${selectedRefIds.length} makale üzerinde arayarak tez danışmanına sorun...`
                      : "Kuramsal teoriler veya nitel/nicel araştırma yöntemleri üzerine tartışma başlatın..."
                }
                disabled={isPending}
                className="flex-1 bg-transparent text-sm text-foreground focus:outline-none px-3 py-1 disabled:text-muted-foreground disabled:cursor-not-allowed resize-none max-h-40 overflow-y-auto leading-relaxed"
              />
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isPending}
                className="bg-primary hover:bg-primary/95 text-primary-foreground border border-primary px-4 py-2 rounded-md text-xs font-extrabold flex items-center gap-2 transition duration-100 disabled:opacity-40 disabled:cursor-not-allowed h-9 self-end"
              >
                {isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                <span>Gönder</span>
              </button>
            </div>
            <div className="max-w-4xl mx-auto mt-2 flex justify-between text-[9px] text-muted-foreground font-sans px-1">
              <span>Enter: Gönder • Shift + Enter: Yeni Satır</span>
              {selectedRefIds.length > 0 && (
                <span className="text-primary font-bold">
                  Arama Filtresi: {selectedRefIds.length} Makale Aktif
                </span>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* MOBILE DRAWER: Sources slide-over overlay for responsive screens */}
      {isMobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex justify-end">
          {/* Backdrop mask */}
          <div
            onClick={() => setIsMobileDrawerOpen(false)}
            className="absolute inset-0 bg-[#000000] opacity-80"
          />

          {/* Drawer container body */}
          <div className="relative w-80 max-w-full h-full bg-card border-l border-border p-5 flex flex-col z-10 shadow-2xl animate-slide-in-right">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4 shrink-0">
              <h3 className="text-sm font-black uppercase text-foreground tracking-wider flex items-center gap-2">
                <BookOpen className="size-4 text-primary" />
                Tartışma Kaynakları
              </h3>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-1 rounded bg-muted hover:bg-accent border border-border text-muted-foreground hover:text-foreground transition"
              >
                <X className="size-4" />
              </button>
            </div>

            {loadingRefs ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Loader2 className="size-6 text-primary animate-spin mb-2" />
                <p className="text-xs text-muted-foreground font-sans">
                  Yükleniyor...
                </p>
              </div>
            ) : references.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-border rounded-lg bg-background">
                <Info className="size-5 text-muted-foreground mb-2" />
                <h3 className="text-xs font-bold text-foreground">
                  Kütüphane Boş
                </h3>
                <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                  RAG araması için PDF yüklemeniz gerekmektedir.
                </p>
                <a
                  href="/library"
                  className="mt-4 flex items-center gap-1 bg-muted hover:bg-accent border border-border px-3 py-1.5 rounded text-[10px] font-bold text-foreground transition"
                >
                  Kütüphaneye Git
                  <ArrowRight className="size-3 text-primary" />
                </a>
              </div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex gap-2 mb-3 shrink-0">
                  <button
                    onClick={handleSelectAllRefs}
                    className="flex-1 bg-muted hover:bg-accent border border-border py-1.5 rounded text-[9px] font-bold text-foreground transition"
                  >
                    Tümünü Seç
                  </button>
                  <button
                    onClick={handleClearAllRefs}
                    className="flex-1 bg-muted hover:bg-accent border border-border py-1.5 rounded text-[9px] font-bold text-foreground transition"
                  >
                    Seçimi Kaldır
                  </button>
                </div>

                {/* References list */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {references.map((ref) => {
                    const isChecked = selectedRefIds.includes(ref.id);
                    return (
                      <div
                        key={ref.id}
                        onClick={() => handleToggleRef(ref.id)}
                        className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer select-none transition ${
                          isChecked
                            ? "bg-muted border-primary"
                            : "bg-background border-border hover:border-muted-foreground"
                        }`}
                      >
                        <div
                          className={`mt-0.5 size-4 rounded border flex items-center justify-center shrink-0 transition ${
                            isChecked
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border bg-card"
                          }`}
                        >
                          {isChecked && <Check className="size-3 stroke-[3]" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-foreground truncate">
                            {ref.title}
                          </h4>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {ref.authors || "Bilinmeyen Yazar"}
                            {ref.year ? ` • ${ref.year}` : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-border pt-4 mt-4 shrink-0">
                  <button
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className="w-full bg-primary hover:bg-primary/95 text-primary-foreground border border-primary py-2.5 rounded-lg text-xs font-extrabold transition"
                  >
                    Filtreleri Uygula ({selectedRefIds.length} Kaynak)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
