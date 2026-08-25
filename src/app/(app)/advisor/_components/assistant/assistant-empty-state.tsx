"use client";

import { Sparkles } from "lucide-react";

/**
 * Minimal empty state component welcoming the user to the thesis assistant.
 *
 * @returns The rendered empty state markup.
 */
export function AssistantEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-3">
      <div className="p-2.5 rounded-full bg-primary/10 text-primary border border-primary/20 shadow-xs">
        <Sparkles className="size-5" />
      </div>
      <h2 className="font-serif text-base font-semibold tracking-tight text-foreground">
        Tez Asistanı ile Çalışmaya Başlayın
      </h2>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Tezinizin kuramsal yapısı, araştırma metodolojiniz veya kütüphanenizdeki
        kaynaklar hakkında dilediğiniz akademik soruyu sorabilirsiniz.
      </p>
    </div>
  );
}
