"use client";

import { Outline, Box } from "@/db/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { getBoxTypeBadgeConfig, ThesisBoxType } from "@/lib/box-constants";

interface ManageBoxLinksModalProps {
  open: boolean;
  outline: Outline | null;
  boxesList: Box[];
  localLinkedBoxMap: Record<number, number[]>;
  onToggleLink: (boxId: number) => void;
  onClose: () => void;
}

/**
 * Topic-box link management dialog listing all boxes with optimistic
 * link/unlink toggles for the selected section.
 *
 * @param root0 - Component props.
 * @param root0.open - Whether the dialog is visible.
 * @param root0.outline - The section whose links are being managed or null.
 * @param root0.boxesList - All thesis topic boxes.
 * @param root0.localLinkedBoxMap - Effective box to outline link map (with optimistic overrides).
 * @param root0.onToggleLink - Box link/unlink toggle handler.
 * @param root0.onClose - Dialog close handler.
 */
export function ManageBoxLinksModal({
  open,
  outline,
  boxesList,
  localLinkedBoxMap,
  onToggleLink,
  onClose,
}: ManageBoxLinksModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg font-semibold text-foreground">
            Bölüme Bağlı Konu Kutularını Yönet
          </DialogTitle>
          <DialogDescription className="font-sans text-xs text-muted-foreground">
            &quot;{outline?.title}&quot; bölümüne bağlı araştırma eksenlerini
            seçin. Bağlanan kutulardaki okuma kaynakları bu bölüme otomatik
            olarak aktarılacaktır.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 py-3 max-h-[60vh] overflow-y-auto pr-1">
          {boxesList.map((box) => {
            const isLinked = outline
              ? (localLinkedBoxMap[outline.id] ?? []).includes(box.id)
              : false;
            const badgeCfg = getBoxTypeBadgeConfig(
              box.boxType as ThesisBoxType,
            );

            return (
              <div
                key={box.id}
                onClick={() => onToggleLink(box.id)}
                className={`flex cursor-pointer items-start justify-between p-3 rounded-md border transition-all ${
                  isLinked
                    ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                    : "border-border/60 bg-card hover:border-border"
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1 pr-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-sans font-medium px-2 py-0.5 border ${badgeCfg.className}`}
                    >
                      {badgeCfg.label}
                    </Badge>
                    <span className="font-serif text-sm font-semibold text-foreground">
                      {box.title}
                    </span>
                  </div>
                  {box.description && (
                    <p className="font-sans text-xs text-muted-foreground line-clamp-2">
                      {box.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  {isLinked ? (
                    <Badge className="bg-primary text-primary-foreground font-sans text-xs flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      <span>Bağlı</span>
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      Bağla
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            size="sm"
            onClick={onClose}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Tamamla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
