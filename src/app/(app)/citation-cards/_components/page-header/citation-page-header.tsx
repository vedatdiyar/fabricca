"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CitationCardsPageHeaderProps {
  onOpenAddDialog: () => void;
}

/**
 * Clean Academic Page Header for Citation Cards & Thesis Workbench.
 *
 * @param props - Component props.
 * @returns Header markup.
 */
export function CitationCardsPageHeader({
  onOpenAddDialog,
}: CitationCardsPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
      <div>
        <h1 className="font-serif text-xl font-semibold tracking-tight text-foreground">
          Alıntı Fişleri & Tez Masası
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tez konu kutularındaki okumaları tez iskeletinin alt başlıklarına
          bağlayan araştırma ve analiz masası.
        </p>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
        {/* Global Add Card Button */}
        <Button
          onClick={onOpenAddDialog}
          className="h-8 text-xs font-medium shrink-0 cursor-pointer gap-1.5"
        >
          <Plus className="size-3.5" />
          <span>Yeni Fiş</span>
        </Button>
      </div>
    </div>
  );
}
