import React from "react";
import { FolderKanban } from "lucide-react";

export function KartoteksHeader() {
  return (
    <header className="border-b border-border pb-6 mb-8 flex justify-between items-center">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FolderKanban className="h-6 w-6 text-primary" />
          <span>Bilgi Fişi Laboratuvarı</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1 font-sans">
          Okuma notlarınızı ve atıf fişlerinizi esnek tematik çalışma kutularına
          tasnif edin
        </p>
      </div>
      <span className="text-xs font-mono text-primary bg-card border border-border px-3 py-1 rounded">
        Active Laboratory
      </span>
    </header>
  );
}
