"use client";

import { Layers } from "lucide-react";
import { getBoxTypeDescription } from "./box-type-info";

interface ReaderEmptyStateProps {
  boxType: string | null | undefined;
}

export function ReaderEmptyState({ boxType }: ReaderEmptyStateProps) {
  const info = getBoxTypeDescription(boxType);

  if (info) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-muted/20 bg-muted/10">
          <Layers className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-center text-sm text-muted-foreground max-w-md px-4 leading-relaxed">
          {info.description}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-10">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-muted/20 bg-muted/10">
        <Layers className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">
        Bu kutu için onaylanmış kaynak bulunmuyor.
      </p>
    </div>
  );
}
