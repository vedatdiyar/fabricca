"use client";

import { Sparkles } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

/**
 * Minimal empty state component welcoming the user to the thesis assistant.
 *
 * @returns The rendered empty state markup.
 */
export function AssistantEmptyState() {
  return (
    <EmptyState
      icon={Sparkles}
      title="Tez Asistanı ile Çalışmaya Başlayın"
      description="Tezinizin kuramsal yapısı, araştırma metodolojiniz veya kütüphanenizdeki kaynaklar hakkında dilediğiniz akademik soruyu sorabilirsiniz."
      layout="centered"
      className="flex-1 max-w-md mx-auto space-y-0"
      iconWrapperClassName="h-auto w-auto p-2.5 rounded-full bg-primary/10 text-primary border border-primary/20 shadow-xs mb-3"
      iconClassName="size-5"
      titleClassName="font-serif text-base font-semibold tracking-tight text-foreground"
      descriptionClassName="text-xs text-muted-foreground leading-relaxed max-w-md"
    />
  );
}
