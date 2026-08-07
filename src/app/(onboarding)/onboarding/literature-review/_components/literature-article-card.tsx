"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { JuryArticle } from "@/lib/types";
import { formatAuthorDisplayString } from "@/lib/academic/author-formatter";

interface LiteratureArticleCardProps {
  article: JuryArticle;
  onDelete?: () => void;
  onEdit?: (newTitle: string) => void;
}

/**
 * Cuts a YÖK-style dual-language thesis title down to its primary (Turkish) portion.
 *
 * @param title - The raw title possibly containing a "Türkçe / English" separator.
 * @returns The primary title fragment, or the raw title when no separator exists.
 */
function cleanDisplayTitle(title: string): string {
  const separatorIndex = title.indexOf(" / ");
  return separatorIndex === -1 ? title : title.slice(0, separatorIndex).trim();
}

/**
 * Maps a raw thesis degree string to a compact badge label.
 *
 * @param thesisType - The raw thesis type value.
 * @returns A short uppercase degree label.
 */
function getThesisDegreeLabel(thesisType: string): string {
  const normalized = thesisType.toLowerCase();
  if (normalized.includes("doktora")) return "DOKTORA";
  if (normalized.includes("yüksek")) return "YÜKSEK LİSANS";
  return thesisType.toUpperCase();
}

/**
 * Renders a compact card summarizing a single jury article, supporting inline editing and deletion with confirmation.
 *
 * @param root0 - Component props.
 * @param root0.article - The jury article to display.
 * @param root0.onDelete - Optional callback invoked when deleting the article.
 * @param root0.onEdit - Optional callback invoked when saving an updated title.
 * @returns The article card UI.
 */
export function LiteratureArticleCard({
  article,
  onDelete,
  onEdit,
}: LiteratureArticleCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(article.title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleSave = () => {
    const trimmed = editedTitle.trim();
    if (!trimmed) return;
    onEdit?.(trimmed);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedTitle(article.title);
    setIsEditing(false);
  };

  const handleConfirmDelete = () => {
    setShowDeleteDialog(false);
    onDelete?.();
  };

  const authorDisplay = formatAuthorDisplayString({
    authors: article.authors,
    publisher: article.publisher,
  });

  const hasMetadata = Boolean(authorDisplay);

  if (isEditing) {
    return (
      <Card className="bg-card border border-primary/40 p-3 flex items-center gap-2 transition-all">
        <Input
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          className="flex-1 h-8 text-xs font-medium"
          autoFocus
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 shrink-0"
          onClick={handleSave}
          title="Kaydet"
        >
          <Check className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
          onClick={handleCancel}
          title="Vazgeç"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card border border-border hover:border-primary/20 transition-all">
        <CardHeader
          className={`p-3.5 ${hasMetadata ? "pb-1.5" : ""} flex flex-row items-center justify-between gap-2 space-y-0`}
        >
          <CardTitle className="text-sm font-medium text-foreground leading-snug break-words hyphens-auto min-w-0">
            {cleanDisplayTitle(article.title)}
          </CardTitle>
          <div className="shrink-0 flex items-center gap-1">
            {article.thesisType && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-primary/10 border-primary/20 text-primary">
                {getThesisDegreeLabel(article.thesisType)}
              </span>
            )}
            {article.isFoundational && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-primary/10 border-primary/20 text-primary">
                KURUCU ESER
              </span>
            )}
            {onEdit && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                onClick={() => setIsEditing(true)}
                title="Düzenle"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                onClick={() => setShowDeleteDialog(true)}
                title="Sil"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>
        {hasMetadata && (
          <CardContent className="px-3.5 pb-3 pt-0">
            <div className="text-xs text-muted-foreground leading-relaxed truncate">
              <span>{authorDisplay}</span>
              {article.publisher &&
                article.authors &&
                article.authors.length > 0 &&
                article.publisher !== authorDisplay && (
                  <span> · {article.publisher}</span>
                )}
            </div>
          </CardContent>
        )}
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-lg font-semibold text-foreground">
              Eseri Silmek İstediğinize Emin Misiniz?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Bu kaynak listeden kaldırılacaktır. Bu işlem geri alınamaz.
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
