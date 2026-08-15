"use client";

import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import type { BoxWithRelations } from "../../constants/quadrant-config";

interface SemanticQueryPreviewProps {
  subBox: BoxWithRelations;
  isOpen: boolean;
  onToggle: () => void;
}

/** Accordion-style toggle revealing the RAG semantic search query of a sub-box. */
export function SemanticQueryPreview({
  subBox,
  isOpen,
  onToggle,
}: SemanticQueryPreviewProps) {
  return (
    <div className="pl-6 pt-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-[10px] font-sans text-muted-foreground hover:text-primary transition-colors"
      >
        <Sparkles className="h-3 w-3 text-primary/80" />
        <span>
          {isOpen
            ? "Semantik Arama Sorgusunu Gizle"
            : "RAG & Literatür Arama Sorgusu"}
        </span>
        {isOpen ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {isOpen && (
        <div className="mt-1.5 p-2 rounded-md bg-background/80 border border-border/60 text-[10px] font-sans text-foreground leading-relaxed">
          <p className="text-muted-foreground mb-1 text-[9px] uppercase tracking-wider font-sans">
            Akademik Veritabanı Arama İfadesi:
          </p>
          <p className="select-all">{subBox.semanticQuery}</p>
        </div>
      )}
    </div>
  );
}
