"use client";

import { useMemo } from "react";
import { FileText } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { computeDiff, type DiffSegment } from "@/lib/diff";

/**
 * Renders aligned word tokens with inline change highlighting.
 *
 * @param root0 - Segment props.
 * @param root0.segments - The aligned diff segments for one column.
 * @param root0.isPolished - Whether this column is the polished (right) side.
 * @returns The token stream markup with highlights.
 */
function DiffLine({
  segments,
  isPolished,
}: {
  segments: DiffSegment[];
  isPolished: boolean;
}) {
  return (
    <p className="whitespace-pre-wrap text-[15px] leading-relaxed font-light text-foreground">
      {segments.map((segment, index) => {
        if (segment.type === "same") {
          return <span key={index}>{segment.value}</span>;
        }
        if (segment.type === "insert") {
          return (
            <span
              key={index}
              className={`rounded-sm bg-success/15 px-0.5 text-success ${isPolished ? "" : "opacity-40"}`}
            >
              {segment.value}
            </span>
          );
        }
        return (
          <span
            key={index}
            className={`rounded-sm bg-destructive/15 px-0.5 text-destructive line-through ${isPolished ? "opacity-40" : ""}`}
          >
            {segment.value}
          </span>
        );
      })}
    </p>
  );
}

interface SideBySideDiffProps {
  original: string;
  polished: string;
}

/**
 * Side-by-side diff view of the original and polished academic text with
 * word-level insertion and deletion highlighting.
 *
 * @param root0 - Component props.
 * @param root0.original - The user's original draft paragraph.
 * @param root0.polished - The redacted and polished paragraph.
 * @returns The side-by-side diff markup.
 */
export function SideBySideDiff({ original, polished }: SideBySideDiffProps) {
  const segments = useMemo(
    () => computeDiff(original, polished),
    [original, polished],
  );

  // Split aligned segments into left (originals surviving) and right (final) columns.
  const leftSegments: DiffSegment[] = useMemo(
    () =>
      segments
        .filter((segment) => segment.type !== "insert")
        .map((segment) =>
          segment.type === "delete"
            ? segment
            : { type: "same" as const, value: segment.value },
        ),
    [segments],
  );
  const rightSegments: DiffSegment[] = useMemo(
    () =>
      segments
        .filter((segment) => segment.type !== "delete")
        .map((segment) =>
          segment.type === "insert"
            ? segment
            : { type: "same" as const, value: segment.value },
        ),
    [segments],
  );

  return (
    <Card className="my-4 rounded-md border border-border">
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
          <FileText className="size-4" />
        </div>
        <div>
          <CardTitle className="text-base">Metin Redaksiyonu</CardTitle>
          <p className="text-xs text-muted-foreground">
            Orijinal ile düzeltilmiş metnin yan yana karşılaştırması
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-md border border-border/40 bg-muted/20 p-4 min-h-0 overflow-y-auto max-h-80">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Orijinal Metin
            </h4>
            <DiffLine segments={leftSegments} isPolished={false} />
          </div>
          <div className="rounded-md border border-success/40 bg-card p-4 min-h-0 overflow-y-auto max-h-80">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-success mb-2">
              Düzeltilmiş Metin
            </h4>
            <DiffLine segments={rightSegments} isPolished={true} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm bg-success/20 border border-success/40" />
            Ekleme
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm bg-destructive/20 border border-destructive/40" />
            Çıkarma
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
