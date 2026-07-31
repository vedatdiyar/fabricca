"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, FolderArchive, Trash2 } from "lucide-react";
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
import type { TopicBox } from "../_types";

interface BoxCardProps {
  box: TopicBox;
  /** Callback to permanently delete a library article linked to this box */
  onDeleteArticle: (articleId: string) => Promise<void>;
}

/**
 * Akademik Konu Kutusu (Topic Box) kart bileşeni.
 * Kutunun adını, açıklamasını ve içindeki makalelerin (Okuma Listesi) listesini okunma durumlarıyla sergiler.
 * Makaleye tıklanınca Kütüphane'de ilgili esere yönlendirir; her makalenin yanında kalıcı silme butonu sunar.
 *
 * @param props.box - Görüntülenecek konu kutusu verisi
 * @param props.onDeleteArticle - Makalenin kalıcı olarak silinmesi için çağrılan callback
 */
export function BoxCard({ box, onDeleteArticle }: BoxCardProps) {
  // Deletion confirmation modal state
  const [articleToDeleteId, setArticleToDeleteId] = useState<string | null>(
    null,
  );

  /**
   * Confirms and permanently deletes the selected article.
   */
  const handleConfirmDelete = async () => {
    if (articleToDeleteId !== null) {
      await onDeleteArticle(articleToDeleteId);
      setArticleToDeleteId(null);
    }
  };

  return (
    <>
      <Card className="flex flex-col h-full rounded-md border border-border bg-card text-card-foreground">
        <CardHeader className="p-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="font-serif text-lg font-medium tracking-tight text-foreground">
                {box.title}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground line-clamp-2">
                {box.description}
              </CardDescription>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
              <FolderArchive className="h-4 w-4" />
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
              <p className="text-xs text-success font-medium">
                Tüm kaynak okumaları tamamlandı!
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {box.articles.map((article) => (
                <li
                  key={article.id}
                  className="flex items-start justify-between gap-3 group rounded-md p-2 hover:bg-secondary/50 transition-colors"
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
                        className="mt-1.5 max-w-full border-primary/25 bg-primary/10 px-2 py-0.5 font-sans text-[10px] font-semibold text-primary"
                      >
                        <span className="truncate">{article.subBoxTitle}</span>
                      </Badge>
                    )}
                  </Link>
                  <div className="flex items-center gap-1.5 pt-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setArticleToDeleteId(article.id)}
                      title="Eseri Sil"
                      aria-label="Eseri Sil"
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {article.isRead && (
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15 border border-success/20 text-success"
                        title="Okundu"
                      >
                        <BookOpen className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Delete Article Confirmation Dialog */}
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
