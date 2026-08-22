"use client";

import Link from "next/link";
import {
  AlertTriangle,
  FolderKanban,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Renders an advisory banner explaining the cascade ripple effect of modifying
 * thesis matrix pillars on downstream topic boxes and thesis outline chapters.
 *
 * @returns The cascade invalidation alert component.
 */
export function MatrixCascadeAlert() {
  return (
    <Card className="flex items-start gap-3 p-3.5 border-amber-500/30 bg-amber-500/5 text-foreground rounded-lg">
      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
        <div>
          <h4 className="font-semibold text-xs text-amber-600 dark:text-amber-400">
            Temel Omurga Değişiklikleri ve Dalga Etkisi
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Tez matrisinizdeki 4 ana sütunda yapacağınız köklü güncellemeler,
            daha önce üretilen <strong>Konu Kutuları</strong> ve{" "}
            <strong>Bölüm Planı</strong> yapınızı doğrudan etkileyebilir.
            Düzenlemeler sonrasında bu alanları gözden geçirmeniz önerilir.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1 border-amber-500/30 text-foreground hover:bg-amber-500/10 cursor-pointer"
          >
            <Link href="/thesis-architecture/boxes">
              <FolderKanban className="h-3 w-3 text-amber-500" />
              <span>Kutuları İncele</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1 border-amber-500/30 text-foreground hover:bg-amber-500/10 cursor-pointer"
          >
            <Link href="/thesis-architecture/outline">
              <BookOpen className="h-3 w-3 text-amber-500" />
              <span>Bölüm Planı</span>
              <ArrowRight className="h-2.5 w-2.5 opacity-60" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
