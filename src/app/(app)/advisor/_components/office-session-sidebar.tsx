"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  Clock,
  Layers,
  MessageSquare,
  Search,
  X,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  deleteOfficeSessionAction,
  type OfficeSessionSummary,
} from "../office-actions";

interface OfficeSessionSidebarProps {
  sessions: OfficeSessionSummary[];
  activeSessionId: number | null;
  onSelectSession: (sessionId: number) => void;
  onNewSession: () => void;
  onSessionDeleted: (deletedSessionId: number) => void;
}

/**
 * Past Office Sessions Sidebar.
 * Matches the exact height of the right submission panel with a balanced, unified layout.
 * Strictly complies with the 5-layer typography standards from UI_RULES.md.
 */
export function OfficeSessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onSessionDeleted,
}: OfficeSessionSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.outlineTitle && s.outlineTitle.toLowerCase().includes(q)) ||
      s.title.toLowerCase().includes(q) ||
      (s.draftText && s.draftText.toLowerCase().includes(q))
    );
  });

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (deletingId) return;

    setDeletingId(id);
    try {
      const res = await deleteOfficeSessionAction(id);
      if (res.success) {
        toast.success("İnceleme oturumu silindi.");
        onSessionDeleted(id);
      } else {
        toast.error(res.error || "Silinemedi.");
      }
    } catch {
      toast.error("Oturum silinirken bir hata oluştu.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="flex h-full w-full flex-col min-h-0 space-y-4 rounded-lg p-5 bg-card border-border shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-primary" />
          <h2 className="font-serif text-base font-semibold tracking-tight text-foreground">
            Geçmiş Randevular
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onNewSession}
            className="h-7 text-xs px-2.5 bg-primary text-primary-foreground hover:bg-primary/90 gap-1 cursor-pointer rounded-md shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>Yeni Taslak</span>
          </Button>
          <Badge
            variant="outline"
            className="text-xs font-medium text-muted-foreground border-border"
          >
            {sessions.length}
          </Badge>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative w-full shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          placeholder="Randevularda ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 pr-7 text-xs h-8 bg-background border-border rounded-md"
        />
        {searchQuery && (
          <button
            type="button"
            aria-label="Aramayı temizle"
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Sessions List / Centered Empty State */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto space-y-2 pr-1">
        {filteredSessions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-5 text-center text-muted-foreground rounded-lg border border-dashed border-border/60 bg-background/40">
            <BookOpen className="size-8 opacity-30 text-muted-foreground mb-2" />
            <h3 className="font-serif text-sm font-semibold text-foreground">
              {sessions.length === 0
                ? "Henüz Randevu Yok"
                : "Arama Sonucu Bulunamadı"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-[220px]">
              {sessions.length === 0
                ? "Word pasajınızı sağdaki masadan teslim ederek ilk danışman incelemenizi başlatın."
                : "Farklı bir arama terimi deneyebilirsiniz."}
            </p>
          </div>
        ) : (
          filteredSessions.map((s) => {
            const isActive = s.id === activeSessionId;

            return (
              <Card
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSession(s.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectSession(s.id);
                  }
                }}
                className={`group relative cursor-pointer transition-all border p-3 rounded-md shrink-0 ${
                  isActive
                    ? "bg-accent/20 border-primary/20"
                    : "bg-background border-border hover:bg-accent/10 hover:border-primary/20"
                }`}
              >
                <CardContent className="p-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <Layers className="size-3.5 text-primary shrink-0" />
                      <h3 className="font-serif text-sm font-semibold text-foreground truncate">
                        {s.outlineTitle || s.title}
                      </h3>
                    </div>

                    <button
                      type="button"
                      aria-label="İncelemeyi Sil"
                      onClick={(e) => handleDelete(e, s.id)}
                      className="opacity-0 group-hover:opacity-100 hover:text-destructive p-0.5 rounded transition-opacity cursor-pointer shrink-0 text-muted-foreground"
                      title="İncelemeyi Sil"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>

                  {s.draftText && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed font-sans">
                      {s.draftText}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1.5 border-t border-border/40 text-xs text-muted-foreground">
                    <span>{s.createdAt}</span>
                    {s.messageCount > 1 && (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="size-3 text-primary" />
                        <span>{s.messageCount} mesaj</span>
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </Card>
  );
}
