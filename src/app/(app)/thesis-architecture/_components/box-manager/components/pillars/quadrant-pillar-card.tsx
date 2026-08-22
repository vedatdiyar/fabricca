"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";
import { getQuadrantConfig } from "../../constants/quadrant-config";
import type { BoxWithRelations } from "../../constants/quadrant-config";
import { SubBoxList } from "./sub-box-list";

interface QuadrantPillarCardProps {
  rootBox: BoxWithRelations;
  subBoxes: BoxWithRelations[];
  expandedSemanticMap: Record<number, boolean>;
  onToggleSemantic: (boxId: number) => void;
  onCopySubBox: (box: BoxWithRelations) => void;
  onEditSubBox: (box: BoxWithRelations) => void;
  onDeleteSubBox: (box: BoxWithRelations) => void;
  onAddSubBox: (parentId: number) => void;
  onEditRootBox: (box: BoxWithRelations) => void;
}

/** Main quadrant pillar card: header bar, sub-topic list/empty state and footer. */
export function QuadrantPillarCard({
  rootBox,
  subBoxes,
  expandedSemanticMap,
  onToggleSemantic,
  onCopySubBox,
  onEditSubBox,
  onDeleteSubBox,
  onAddSubBox,
  onEditRootBox,
}: QuadrantPillarCardProps) {
  const config = getQuadrantConfig(rootBox.boxType, rootBox.title);
  const Icon = config.icon;

  return (
    <Card className="flex flex-col h-full bg-card transition-all border-border hover:border-border/80">
      {/* Quadrant Card Header */}
      <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/40 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${config.accentColor}`}
            >
              <Icon className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`border ${config.badgeColor}`}
                >
                  Sütun #{config.number}
                </Badge>
                <span className="font-sans text-xs text-muted-foreground">
                  {config.shortLabel}
                </span>
              </div>
              <CardTitle className="font-serif text-base font-semibold tracking-tight text-foreground leading-snug">
                {rootBox.title}
              </CardTitle>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => onAddSubBox(rootBox.id)}
              title="Bu eksene yeni alt konu ekle"
              aria-label="Alt Konu Ekle"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => onEditRootBox(rootBox)}
              title="Ana eksen başlığını düzenle"
              aria-label="Düzenle"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {rootBox.description && (
          <CardDescription className="font-sans text-xs leading-relaxed text-muted-foreground pl-12">
            {rootBox.description}
          </CardDescription>
        )}
      </CardHeader>

      {/* Sub-Topics List */}
      <CardContent className="flex flex-1 flex-col p-4 sm:p-5 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Alt Konu ve Havuzlar ({subBoxes.length})
          </h4>
        </div>

        <SubBoxList
          subBoxes={subBoxes}
          expandedSemanticMap={expandedSemanticMap}
          onToggleSemantic={onToggleSemantic}
          onCopy={onCopySubBox}
          onEdit={onEditSubBox}
          onDelete={onDeleteSubBox}
          onAddSubBox={() => onAddSubBox(rootBox.id)}
        />
      </CardContent>

      {/* Card Footer */}
      <CardFooter className="p-4 sm:p-5 pt-0 flex items-center justify-between border-t border-border/40 mt-auto text-xs text-muted-foreground">
        <span className="font-sans text-[10px]">
          {subBoxes.length} alt konu tanımlı
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAddSubBox(rootBox.id)}
          className="h-6 px-2 text-[10px] text-primary hover:text-primary/80 gap-1"
        >
          <Plus className="h-3 w-3" />
          <span>Alt Konu Ekle</span>
        </Button>
      </CardFooter>
    </Card>
  );
}
