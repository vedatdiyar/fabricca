"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Copy,
  Pencil,
  Trash2,
  Hash,
  Library,
  ListTodo,
} from "lucide-react";
import { SemanticQueryPreview } from "./semantic-query-preview";
import type { BoxWithRelations } from "../../constants/quadrant-config";

interface SubBoxItemProps {
  subBox: BoxWithRelations;
  isSemanticOpen: boolean;
  onToggleSemantic: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** Single sub-topic card with concept chips, semantic query preview and meta links. */
export function SubBoxItem({
  subBox,
  isSemanticOpen,
  onToggleSemantic,
  onCopy,
  onEdit,
  onDelete,
}: SubBoxItemProps) {
  const concepts = Array.isArray(subBox.concepts) ? subBox.concepts : [];
  const sourceCount = subBox.sources?.length ?? 0;
  const taskCount = subBox.tasks?.length ?? 0;

  return (
    <div className="rounded-md border border-border/60 bg-muted/15 p-3.5 transition-all hover:border-border hover:bg-muted/25 space-y-2.5">
      {/* Sub-Box Header & Quick Actions */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <FileText className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground leading-snug">
              {subBox.title}
            </h3>
            {subBox.description && (
              <p className="font-sans text-xs leading-relaxed text-muted-foreground">
                {subBox.description}
              </p>
            )}
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onCopy}
            title="Metni Kopyala"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
            title="Alt Konuyu Düzenle"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            title="Alt Konuyu Sil"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Concepts & Keywords Chips */}
      {concepts.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pl-6 pt-0.5">
          {concepts.map((concept, cIdx) => (
            <Badge
              key={cIdx}
              variant="secondary"
              className="gap-1 border border-border/40 bg-card px-2 py-0.5 font-sans text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Hash className="h-2.5 w-2.5 text-muted-foreground/60" />
              <span>{concept}</span>
            </Badge>
          ))}
        </div>
      )}

      {/* Semantic Search Query preview (used for RAG retrieval) */}
      {subBox.semanticQuery && (
        <SemanticQueryPreview
          subBox={subBox}
          isOpen={isSemanticOpen}
          onToggle={onToggleSemantic}
        />
      )}

      {/* Meta Badges Footer */}
      <div className="flex items-center gap-3 pl-6 pt-1 text-[10px] font-sans text-muted-foreground border-t border-border/20">
        <Link
          href="/library"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          title="Kütüphanedeki kaynakları görüntüle"
        >
          <Library className="h-3 w-3 text-primary/70" />
          <span>{sourceCount} Kaynak</span>
        </Link>

        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          title="İlişkili görevleri panoda görüntüle"
        >
          <ListTodo className="h-3 w-3 text-amber-400/70" />
          <span>{taskCount} Görev</span>
        </Link>
      </div>
    </div>
  );
}
