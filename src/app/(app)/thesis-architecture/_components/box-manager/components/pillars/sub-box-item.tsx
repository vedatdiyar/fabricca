"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Copy,
  Pencil,
  Trash2,
  Hash,
  MoreHorizontal,
  Sparkles,
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

/** Single sub-topic card with dropdown menu and concept chips. */
export function SubBoxItem({
  subBox,
  isSemanticOpen,
  onToggleSemantic,
  onCopy,
  onEdit,
  onDelete,
}: SubBoxItemProps) {
  const concepts = Array.isArray(subBox.concepts) ? subBox.concepts : [];

  return (
    <div className="group rounded-lg border border-border/60 bg-card p-3.5 sm:p-4 transition-all duration-150 hover:border-border/90 hover:bg-card/90 space-y-2.5">
      {/* Header: Title + Contextual Dropdown Menu */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground leading-snug">
            {subBox.title}
          </h3>
          {subBox.description && (
            <p className="font-sans text-xs font-normal leading-relaxed text-muted-foreground">
              {subBox.description}
            </p>
          )}
        </div>

        {/* Clean Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0 rounded-md"
              aria-label="İşlemler"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={onEdit}
              className="cursor-pointer gap-2 text-xs"
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Düzenle</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onCopy}
              className="cursor-pointer gap-2 text-xs"
            >
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Metni Kopyala</span>
            </DropdownMenuItem>
            {subBox.semanticQuery && (
              <DropdownMenuItem
                onClick={onToggleSemantic}
                className="cursor-pointer gap-2 text-xs"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>
                  {isSemanticOpen
                    ? "RAG Sorgusunu Gizle"
                    : "RAG Sorgusunu Göster"}
                </span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="cursor-pointer gap-2 text-xs text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Alt Konuyu Sil</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Concept Tags */}
      {concepts.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {concepts.map((concept, cIdx) => (
            <span
              key={`${concept}-${cIdx}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/70 text-secondary-foreground font-sans text-[11px] font-medium"
            >
              <Hash className="h-2.5 w-2.5 text-muted-foreground" />
              <span>{concept}</span>
            </span>
          ))}
        </div>
      )}

      {/* Semantic Query Preview */}
      {subBox.semanticQuery && (
        <SemanticQueryPreview
          subBox={subBox}
          isOpen={isSemanticOpen}
          onToggle={onToggleSemantic}
        />
      )}
    </div>
  );
}
