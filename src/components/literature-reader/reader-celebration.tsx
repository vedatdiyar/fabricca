"use client";

import { CheckCircle } from "lucide-react";

export function ReaderCelebration() {
  return (
    <div className="animate-in fade-in flex flex-col items-center justify-center gap-4 p-10">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-success/20 bg-success/10">
        <CheckCircle className="h-8 w-8 text-success" />
      </div>
      <p className="text-xl font-semibold text-foreground">Tebrikler!</p>
      <p className="text-center text-sm text-muted-foreground leading-relaxed">
        Bu kutuya ait tüm kaynakları okudunuz.
      </p>
    </div>
  );
}
