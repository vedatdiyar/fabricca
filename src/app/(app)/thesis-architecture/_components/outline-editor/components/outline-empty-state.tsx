"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Plus } from "lucide-react";

interface OutlineEmptyStateProps {
  onAddRoot: () => void;
}

/**
 * Empty-state card shown when no outline sections exist yet.
 *
 * @param root0 - Component props.
 * @param root0.onAddRoot - Callback for creating the first root section.
 */
export function OutlineEmptyState({ onAddRoot }: OutlineEmptyStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-border bg-card">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/40 text-muted-foreground mb-4">
        <BookOpen className="h-6 w-6" />
      </div>
      <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground mb-1">
        Henüz Tez Bölüm Planı Oluşturulmadı
      </h2>
      <p className="font-sans text-sm text-muted-foreground max-w-md mb-6">
        Tez matrisinize ve araştırma eksenlerinize uygun olarak ana bölümler ve
        alt başlıklar ekleyerek tezinizin iskeletini oluşturun.
      </p>
      <Button
        size="sm"
        onClick={onAddRoot}
        className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" />
        <span>İlk Ana Bölümü Ekle</span>
      </Button>
    </Card>
  );
}

/**
 * Placeholder card shown when no section is selected in the outline tree.
 */
export function NoSectionSelectedState() {
  return (
    <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-border bg-card min-h-[350px]">
      <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
      <h3 className="font-serif text-base font-semibold text-foreground mb-1">
        Bölüm Detaylarını Görüntüleyin
      </h3>
      <p className="text-xs text-muted-foreground max-w-sm">
        Detaylarını incelemek ve bağlı okuma kaynaklarını yönetmek için soldaki
        Bölüm İskeletinden bir bölüm seçin.
      </p>
    </Card>
  );
}
