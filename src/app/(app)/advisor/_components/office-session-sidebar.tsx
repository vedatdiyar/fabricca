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
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
 * Past Office Sessions Card / Sidebar.
 * Displays previous draft reviews and allows rapid session switching.
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
    <Card className="w-full border-border bg-card shadow-xs flex flex-col overflow-hidden">
      {/* Header */}
      <CardHeader className="p-4 pb-3 border-b border-border/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <CardTitle className="font-serif text-sm font-semibold text-foreground">
              Geçmiş Randevular
            </CardTitle>
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground"
            >
              {sessions.length}
            </Badge>
          </div>

          <Button
            size="sm"
            onClick={onNewSession}
            className="h-7 text-xs px-2.5 bg-primary text-primary-foreground hover:bg-primary/90 gap-1 cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            <span>Yeni Taslak</span>
          </Button>
        </div>

        {/* Search */}
        {sessions.length > 3 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Randevularda ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-7 text-xs h-7 bg-background border-border"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Aramayı temizle"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </CardHeader>

      {/* Sessions List */}
      <CardContent className="p-2 flex-1 max-h-[500px] overflow-y-auto space-y-1.5">
        {filteredSessions.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <FileText className="h-6 w-6 text-muted-foreground/50" />
            <span>
              {sessions.length === 0
                ? "Henüz geçmiş taslak incelemeniz bulunmuyor."
                : "Aramanızla eşleşen randevu bulunamadı."}
            </span>
          </div>
        ) : (
          filteredSessions.map((s) => {
            const isActive = s.id === activeSessionId;

            return (
              <div
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
                className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex flex-col gap-1.5 relative group ${
                  isActive
                    ? "bg-primary/10 border-primary/30 text-foreground"
                    : "bg-card hover:bg-muted/50 border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="font-medium text-foreground truncate">
                      {s.outlineTitle || s.title}
                    </span>
                  </div>

                  <button
                    type="button"
                    aria-label="İncelemeyi Sil"
                    onClick={(e) => handleDelete(e, s.id)}
                    className="opacity-0 group-hover:opacity-100 hover:text-destructive p-1 rounded transition-opacity cursor-pointer shrink-0"
                    title="İncelemeyi Sil"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {s.draftText && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {s.draftText}
                  </p>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] text-muted-foreground">
                  <span>{s.createdAt}</span>
                  {s.messageCount > 1 && (
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {s.messageCount} mesaj
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
