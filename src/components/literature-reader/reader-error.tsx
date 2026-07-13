"use client";

import { BookOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReaderErrorProps {
  onRetry: () => void;
}

export function ReaderError({ onRetry }: ReaderErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-10">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10">
        <BookOpen className="h-6 w-6 text-destructive" />
      </div>
      <p className="text-sm text-muted-foreground">
        Kaynaklar yüklenirken bir hata oluştu.
      </p>
      <Button variant="outline" size="sm" className="gap-2" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" />
        Yeniden Dene
      </Button>
    </div>
  );
}
