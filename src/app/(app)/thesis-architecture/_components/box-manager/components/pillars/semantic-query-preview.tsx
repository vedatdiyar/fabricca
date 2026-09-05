"use client";

import { Sparkles, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { toast } from "sonner";
import type { BoxWithRelations } from "../../constants/quadrant-config";

import { parseDualSemanticQuery } from "@/lib/academic/utils";

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

  const { openAlexSemanticQuery } = parseDualSemanticQuery(subBox.semanticQuery);

  const handleCopyQuery = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(openAlexSemanticQuery || subBox.semanticQuery || "");
    toast.success("RAG arama sorgusu kopyalandı.");
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
        <div className="mt-2 p-2.5 rounded-md bg-secondary/40 border border-border/60 text-xs font-sans space-y-2 relative group/preview">
          <button
            type="button"
            onClick={handleCopyQuery}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-background border border-border/40 text-muted-foreground hover:text-foreground opacity-0 group-hover/preview:opacity-100 transition-opacity cursor-pointer"
            title="Sorguyu Kopyala"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>

          <div className="bg-background/50 p-2 rounded border border-border/40">
            <span className="text-[10px] uppercase font-semibold text-primary block mb-1">
              OpenAlex (GTE-Large-EN Vektör Paragrafı)
            </span>
            <p className="font-mono text-xs text-foreground select-all leading-relaxed">
              {openAlexSemanticQuery || subBox.semanticQuery}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
