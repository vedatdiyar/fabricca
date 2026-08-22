"use client";

import { Sparkles, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { toast } from "sonner";
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
  if (!subBox.semanticQuery) return null;

  const handleCopyQuery = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (subBox.semanticQuery) {
      navigator.clipboard.writeText(subBox.semanticQuery);
      toast.success("RAG arama sorgusu kopyalandı.");
    }
  };

  return (
    <div className="pt-0.5">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1.5 text-xs font-sans text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <Sparkles className="h-3 w-3 text-primary" />
        <span className="font-medium">
          {isOpen ? "RAG Sorgusunu Gizle" : "RAG Arama Sorgusu"}
        </span>
        {isOpen ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {isOpen && (
        <div className="mt-2 p-2.5 rounded-md bg-secondary/40 border border-border/60 text-xs font-sans space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-medium">
              Akademik Literatür Arama İfadesi
            </span>
            <button
              type="button"
              onClick={handleCopyQuery}
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
              title="Sorguyu kopyala"
            >
              <Copy className="h-3 w-3" />
              <span>Kopyala</span>
            </button>
          </div>
          <p className="font-mono text-xs text-foreground select-all leading-relaxed bg-background/50 p-2 rounded border border-border/40">
            {subBox.semanticQuery}
          </p>
        </div>
      )}
    </div>
  );
}
