"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, Trash2, Library } from "lucide-react";
import { LiteratureExpansionButton } from "@/components/shared/literature-expansion-button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getBoxTypeBadgeConfig, type ThesisBoxType } from "@/lib/box-constants";
import type { TopicBox } from "../_lib/types";

interface BoxCardProps {
  box: TopicBox;
  onDeleteArticle: (articleId: string) => Promise<void>;
  onExpansionSuccess: () => void;
}

/**
 * Renders a topic box card with its reading list, progress metrics, and literature expansion controls.
 *
 * @param root0 - Component props.
 * @param root0.box - The topic box data to display.
 * @param root0.onDeleteArticle - Async callback invoked when an article is deleted.
 * @param root0.onExpansionSuccess - Callback invoked after literature expansion completes.
 * @returns The rendered box card.
 */
export function BoxCard({
  box,
  onDeleteArticle,
  onExpansionSuccess,
}: BoxCardProps) {
  const [articleToDeleteId, setArticleToDeleteId] = useState<string | null>(
    null,
  );

  const handleConfirmDelete = async () => {
    if (articleToDeleteId !== null) {
      await onDeleteArticle(articleToDeleteId);
      setArticleToDeleteId(null);
    }
  };

  const isThesesBox = box.boxType === "RELATED_THESES";
  const badgeConfig = getBoxTypeBadgeConfig(box.boxType as ThesisBoxType);

  const totalArticles = box.articles.length;
  const readArticles = box.articles.filter((a) => a.isRead).length;
  const readPercent =
    totalArticles > 0 ? Math.round((readArticles / totalArticles) * 100) : 0;

  return (
    <>
      <Card className="flex flex-col h-full rounded-md border border-border bg-card text-card-foreground transition-all duration-200 hover:border-border/80">
        <CardHeader className="p-5 pb-3 space-y-3">
          {/* Top Row: Box Category Badge & Literature Expansion Button */}
          <div className="flex items-center justify-between gap-3">
            <Badge
              variant="outline"
              className={`shrink-0 border px-2.5 py-0.5 text-xs font-medium ${badgeConfig.className}`}
            >
              {badgeConfig.label}
            </Badge>

            {!isThesesBox && (
              <div className="flex shrink-0 items-center">
                <LiteratureExpansionButton
                  boxId={Number(box.id)}
                  expansionCycle={box.expansionCycle}
                  isReadyToExpand={box.isReadyToExpand}
                  onSuccess={onExpansionSuccess}
                />
              </div>
            )}
          </div>

          {/* Title & Description (calibrated min-h keeps sibling cards aligned without excessive gap) */}
          <div className="min-h-[76px] space-y-1">
            <CardTitle
              className="font-serif text-sm font-semibold tracking-tight text-foreground line-clamp-2"
              title={box.title}
            >
              {box.title}
            </CardTitle>
            {box.description && (
              <CardDescription
                className="text-xs text-muted-foreground leading-relaxed line-clamp-2"
                title={box.description}
              >
                {box.description}
              </CardDescription>
            )}
          </div>

          {/* Reading Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Okuma İlerlemesi</span>
              <span className="font-medium text-foreground">
                {`${readArticles} / ${totalArticles} Eser (%${readPercent})`}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all duration-500 rounded-full"
                style={{ width: `${readPercent}%` }}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col flex-1 p-5 pt-0">
          <div className="border-t border-border/40 my-3" />

          {/* Sub-header: Okuma Listesi */}
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Okuma Listesi
            </h4>
            {totalArticles > 0 && (
              <span className="font-sans text-[10px] font-medium text-muted-foreground px-2 py-0.5 rounded-full border border-border/40 bg-secondary/20">
                {totalArticles} Eser
              </span>
            )}
          </div>

          {/* Reading List Items */}
          {totalArticles === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-8 px-4 rounded-md border border-dashed border-border/40 bg-secondary/10 text-center min-h-[180px]">
              <Library className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground font-medium">
                İlgili kutuda henüz okunacak materyal bulunmamaktadır.
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                Kütüphane üzerinden yeni eserler ekleyebilir veya literatür
                genişletmeyi başlatabilirsiniz.
              </p>
            </div>
          ) : (
            <ul className="space-y-2 flex-1 flex flex-col justify-start">
              {box.articles.map((article) => (
                <li
                  key={article.id}
                  className="group relative flex flex-col justify-center rounded-md border border-border/40 bg-background/40 px-3.5 py-2.5 hover:border-primary/30 hover:bg-accent/10 transition-all duration-150"
                >
                  <Link
                    href={`/library?id=${article.id}`}
                    aria-label={article.title}
                    className="absolute inset-0 z-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  />
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        {article.isRead ? (
                          <CheckCircle2
                            className="h-4 w-4 shrink-0 text-success mt-0.5"
                            aria-label="Okundu"
                          />
                        ) : (
                          <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors mt-0.5" />
                        )}
                        <p className="font-sans text-xs sm:text-sm font-medium leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {article.title}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setArticleToDeleteId(article.id);
                        }}
                        title="Eseri Sil"
                        aria-label="Eseri Sil"
                        className="opacity-0 group-hover:opacity-100 relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-destructive hover:border-destructive/20 hover:bg-destructive/10 transition-all"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-6">
                      <span className="truncate">{article.author}</span>
                      {article.year && article.year > 0 ? (
                        <>
                          <span className="text-border">•</span>
                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground/80">
                            {article.year}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={articleToDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setArticleToDeleteId(null);
        }}
      >
        <AlertDialogContent className="rounded-md border border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Eseri Silmek İstediğinize Emin Misiniz?
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              Bu akademik eser, PDF dosyası, vektör verileri ve tüm notlarınızla
              birlikte Kütüphaneden kalıcı olarak silinecektir. Bu işlem geri
              alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-md text-xs font-medium">
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-medium"
            >
              Evet, Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
