"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { LiteratureExpansionButton } from "@/features/literature-expansion/_components/literature-expansion-button";
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

  return (
    <>
      <Card className="flex flex-col h-full rounded-md text-card-foreground">
        <CardHeader className="p-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="font-sans text-lg font-medium tracking-tight text-foreground">
                {box.title}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground line-clamp-2">
                {box.description}
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-start">
              <LiteratureExpansionButton
                boxId={Number(box.id)}
                expansionCycle={box.expansionCycle}
                isReadyToExpand={box.isReadyToExpand}
                onSuccess={onExpansionSuccess}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-4 pt-0">
          <div className="border-t border-border/40 my-3" />
          <h4 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Okuma Listesi
          </h4>
          {box.articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 px-3 rounded-md border border-dashed border-border/40 bg-secondary/10 text-center">
              <p className="text-xs text-muted-foreground font-medium">
                İlgili kutuda okunacak materyal şu aşamada bulunmamaktadır.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {box.articles.map((article) => (
                <li
                  key={article.id}
                  className="flex items-start justify-between gap-3 group rounded-md p-2 hover:bg-secondary/20 transition-colors"
                >
                  <Link
                    href={`/library?id=${article.id}`}
                    className="min-w-0 flex-1"
                    title="Kütüphanede Aç"
                  >
                    <p className="font-sans text-sm font-medium leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
                      {article.title}
                    </p>
                    <p className="font-sans text-xs text-muted-foreground mt-1 truncate">
                      {article.author}
                      {article.year && article.year > 0
                        ? ` (${article.year})`
                        : ""}
                    </p>
                    {article.subBoxTitle && (
                      <Badge
                        variant="outline"
                        className="mt-2 max-w-full border-primary/20 bg-primary/10 px-2 py-1 font-sans text-[10px] font-semibold text-primary"
                      >
                        <span className="truncate">{article.subBoxTitle}</span>
                      </Badge>
                    )}
                  </Link>
                  <div className="flex items-center gap-2 pt-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setArticleToDeleteId(article.id)}
                      title="Eseri Sil"
                      aria-label="Eseri Sil"
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-destructive hover:border-destructive/20 hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
            <AlertDialogTitle className="font-serif text-xl font-semibold text-foreground">
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
