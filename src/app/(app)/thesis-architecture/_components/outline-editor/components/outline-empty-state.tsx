"use client";

import { BookOpen, Plus } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

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
    <EmptyState
      icon={BookOpen}
      title="Henüz Tez Bölüm Planı Oluşturulmadı"
      description="Tez matrisinize ve araştırma eksenlerinize uygun olarak ana bölümler ve alt başlıklar ekleyerek tezinizin iskeletini oluşturun."
      actions={[
        { label: "İlk Ana Bölümü Ekle", onClick: onAddRoot, icon: Plus },
      ]}
    />
  );
}

/**
 * Placeholder card shown when no section is selected in the outline tree.
 */
export function NoSectionSelectedState() {
  return (
    <EmptyState
      icon={BookOpen}
      title="Bölüm Detaylarını Görüntüleyin"
      description="Detaylarını incelemek ve bağlı okuma kaynaklarını yönetmek için soldaki Bölüm İskeletinden bir bölüm seçin."
      className="min-h-[350px]"
    />
  );
}
