"use client";

import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
interface CitationCardsPageHeaderProps {
  isSynthesisOpen: boolean;
  hasAnyCard: boolean;
  onToggleSynthesis: () => void;
  onOpenAddDialog: () => void;
}

export function CitationCardsPageHeader({
  isSynthesisOpen,
  hasAnyCard,
  onToggleSynthesis,
  onOpenAddDialog,
}: CitationCardsPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
          Alıntı Fişleri & Tez Masası
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tez konu kutularındaki okumaları tez iskeletinin (Outline) alt
          başlıklarına bağlayan araştırma masası.
        </p>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
        {/* 1-Click AI Synthesis Action */}
        <Button
          variant={isSynthesisOpen ? "secondary" : "outline"}
          size="sm"
          onClick={onToggleSynthesis}
          disabled={!hasAnyCard}
          className={`gap-1.5 h-9 px-3.5 border-primary/30 text-xs font-medium cursor-pointer transition-colors ${
            isSynthesisOpen
              ? "bg-primary/15 text-primary border-primary/40"
              : "bg-primary/5 hover:bg-primary/10 text-primary"
          }`}
        >
          <Sparkles className="h-4 w-4 text-primary" />
          <span>
            {isSynthesisOpen ? "Sentezi Gizle" : "Fikir & Argüman Sentezi"}
          </span>
        </Button>

        {/* Global Add Card Button */}
        <Button
          onClick={onOpenAddDialog}
          size="sm"
          className="gap-1.5 h-9 px-3.5 shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Yeni Fiş</span>
        </Button>
      </div>
    </div>
  );
}
