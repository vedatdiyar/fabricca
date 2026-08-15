"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, Trash2 } from "lucide-react";
import { LiteratureExpansionButton } from "@/features/literature-expansion/_components/literature-expansion-button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
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
import type { TopicBox } from "../_lib/types";

interface BoxCardProps {
  box: TopicBox;
  onDeleteArticle: (articleId: string) => Promise<void>;
  onExpansionSuccess: () => void;
}

/**
 * Renders a topic box card with its reading list and per-article deletion.
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

  return (
    <>
      <Card className="flex flex-col h-full rounded-md text-card-foreground">
        <CardHeader className="p-4 pb-0">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0 flex-1">
              <CardTitle
                className="font-sans text-base sm:text-lg font-semibold tracking-tight text-foreground line-clamp-2 min-h-[3.25rem] flex items-start"
                title={box.title}
              >
                {box.title}
              </CardTitle>
              <CardDescription
                className="text-xs text-muted-foreground leading-relaxed min-h-[4.25rem] flex items-start"
                title={box.description}
              >
                {box.description}
              </CardDescription>
            </div>
            {!isThesesBox && (
              <div className="flex shrink-0 items-start pt-0.5">
                <LiteratureExpansionButton
                  boxId={Number(box.id)}
                  expansionCycle={box.expansionCycle}
                  isReadyToExpand={box.isReadyToExpand}
                  onSuccess={onExpansionSuccess}
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 p-4 pt-0">
          <div className="border-t border-border/40 my-3" />
          <div className="flex items-center justify-between mb-3 h-5">
            <h4 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Okuma Listesi
            </h4>
            {box.articles.length > 0 && (
              <span className="font-sans text-[10px] font-medium text-muted-foreground px-2 py-0.5 rounded-full border border-border/40 bg-secondary/10">
                {box.articles.length} Eser
              </span>
            )}
          </div>
          {box.articles.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-6 px-3 rounded-md border border-dashed border-border/40 bg-secondary/10 text-center min-h-[268px]">
              <p className="text-xs text-muted-foreground font-medium">
                İlgili kutuda okunacak materyal şu aşamada bulunmamaktadır.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5 flex-1 flex flex-col justify-start">
              {box.articles.map((article) => (
                <li
                  key={article.id}
                  className="group relative flex flex-col justify-center cursor-pointer rounded-md border border-border/40 bg-card/60 px-3 py-2 hover:border-primary/20 hover:bg-accent/10 transition-all min-h-[60px]"
                >
                  <Link
                    href={`/library?id=${article.id}`}
                    aria-label={article.title}
                    className="absolute inset-0 z-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {article.isRead ? (
                            <CheckCircle2
                              className="h-4 w-4 shrink-0 text-success"
                              aria-label="Okundu"
                            />
                          ) : (
                            <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                          )}
                          <p className="font-sans text-sm font-medium leading-snug text-foreground group-hover:text-primary transition-colors">
                            {article.title}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setArticleToDeleteId(article.id)}
                        title="Eseri Sil"
                        aria-label="Eseri Sil"
                        className="opacity-0 group-hover:opacity-100 relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-destructive hover:border-destructive/20 hover:bg-destructive/10 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-6">
                      <span className="truncate max-w-[240px]">
                        {article.author}
                      </span>
                      {article.year && article.year > 0 ? (
                        <>
                          <span className="text-border">•</span>
                          <span className="shrink-0">{article.year}</span>
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-lg font-semibold text-foreground">
              Eseri Silmek İstediğinize Emin Misiniz?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Bu akademik eser, PDF dosyası, vektör verileri ve tüm notlarınızla
              birlikte Kütüphaneden kalıcı olarak silinecektir. Bu işlem geri
              alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs font-medium">
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-medium"
            >
              Evet, Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
