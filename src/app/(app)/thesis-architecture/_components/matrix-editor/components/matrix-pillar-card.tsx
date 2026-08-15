"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Copy, Pencil, FileText } from "lucide-react";
import type { MatrixCardDef, MatrixKey } from "../constants/matrix-cards";
import {
  countWords,
  splitParagraphs,
  copyToClipboard,
} from "../utils/text-metrics";
import { MatrixGuidingAccordion } from "./matrix-guiding-accordion";

interface MatrixPillarCardProps {
  card: MatrixCardDef;
  value: string;
  onEdit: (key: MatrixKey) => void;
}

/**
 * Renders a single matrix pillar card: header with copy/edit actions,
 * paragraph breakdown or empty state, guiding questions accordion and footer.
 *
 * @param root0 - Component props.
 * @param root0.card - The matrix column definition being rendered.
 * @param root0.value - The current pillar text.
 * @param root0.onEdit - Opens the edit modal for the given pillar key.
 */
export function MatrixPillarCard({
  card,
  value,
  onEdit,
}: MatrixPillarCardProps) {
  const wordCount = countWords(value);
  const charCount = value.length;
  const paragraphs = splitParagraphs(value);
  const Icon = card.icon;

  return (
    <Card className="flex flex-col h-full bg-card transition-all border-border hover:border-border/80">
      {/* Card Header */}
      <CardHeader className="p-4 sm:p-5 pb-3 flex flex-row items-start justify-between space-y-0 gap-3 border-b border-border/40">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${card.accentColor}`}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-[10px] font-semibold px-2 py-0.5 border ${card.badgeColor}`}
              >
                Sütun #{card.number}
              </Badge>
              <span className="font-sans text-xs text-muted-foreground">
                {card.badgeLabel}
              </span>
            </div>
            <CardTitle className="font-serif text-base font-semibold tracking-tight text-foreground">
              {card.title}
            </CardTitle>
            <CardDescription className="font-sans text-xs text-muted-foreground">
              {card.description}
            </CardDescription>
          </div>
        </div>

        {/* Header Action Toolbar */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => copyToClipboard(value, card.title)}
            title="Metni Kopyala"
            aria-label="Metni Kopyala"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => onEdit(card.key)}
            title="Düzenle"
            aria-label="Düzenle"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      {/* Card Content */}
      <CardContent className="flex flex-1 flex-col p-4 sm:p-5 pt-4 space-y-3">
        {paragraphs.length > 0 ? (
          <div className="flex-1 rounded-md border border-border/40 bg-muted/10 p-4.5 font-sans text-sm leading-relaxed text-foreground min-h-[280px] space-y-3 select-text text-left">
            {paragraphs.map((p, idx) => (
              <p key={idx} className="text-foreground/95">
                {p}
              </p>
            ))}
          </div>
        ) : (
          <div
            onClick={() => onEdit(card.key)}
            className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/5 p-8 text-center hover:border-primary/40 hover:bg-muted/15 transition-colors min-h-[280px] space-y-2 group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/30 text-muted-foreground group-hover:text-primary transition-colors">
              <FileText className="h-5 w-5" />
            </div>
            <p className="font-serif text-sm font-medium text-foreground">
              Bu sütun henüz doldurulmadı
            </p>
            <p className="font-sans text-xs text-muted-foreground max-w-sm">
              Tezinizin bu ayağını yapılandırmak için buraya veya sağ üstteki
              &quot;Düzenle&quot; butonuna tıklayın.
            </p>
          </div>
        )}

        {/* Guiding Questions Accordion */}
        <MatrixGuidingAccordion questions={card.guidingQuestions} />
      </CardContent>

      {/* Card Footer */}
      <CardFooter className="p-4 sm:p-5 pt-0 flex items-center justify-between border-t border-border/40 mt-auto text-xs text-muted-foreground">
        <span className="font-sans">
          {wordCount > 0
            ? `${wordCount} kelime • ${charCount} karakter`
            : "0 kelime"}
        </span>
      </CardFooter>
    </Card>
  );
}
