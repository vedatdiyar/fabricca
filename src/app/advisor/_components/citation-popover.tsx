"use client";

import React from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { FileText } from "lucide-react";
import { CitationSource } from "../actions";

interface CitationPopoverProps {
  chunkDbId: number;
  sources?: CitationSource[];
}

export function CitationPopover({ chunkDbId, sources }: CitationPopoverProps) {
  const source = sources?.find((s) => s.id === chunkDbId);

  if (!source) {
    return <span className="text-primary font-bold">[{chunkDbId}]</span>;
  }

  const sourceIndex = sources
    ? sources.findIndex((s) => s.id === chunkDbId)
    : -1;
  const displayIndex = sourceIndex !== -1 ? sourceIndex + 1 : chunkDbId;

  return (
    <Popover>
      <PopoverTrigger className="mx-0.5 px-1 py-0.2 bg-muted hover:bg-primary border border-border hover:border-primary text-primary hover:text-primary-foreground font-mono text-[9px] font-bold rounded cursor-pointer transition select-none active:scale-95 duration-100">
        {displayIndex}
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] p-4 border border-primary"
        align="center"
        side="top"
      >
        <span className="flex items-center justify-between border-b border-border pb-1.5 mb-2 shrink-0">
          <span className="font-extrabold text-[10px] uppercase text-primary tracking-wider truncate max-w-[180px] flex items-center gap-1.5 font-sans">
            <FileText className="size-3 text-primary shrink-0" />
            {source.title}
          </span>
          <span className="text-[9px] bg-muted px-2 py-0.5 rounded text-primary font-mono select-none">
            {(source.score * 100).toFixed(0)}% Eşleşme
          </span>
        </span>
        <span className="text-[11px] leading-relaxed text-muted-foreground block max-h-40 overflow-y-auto select-text font-sans font-medium pr-1 [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:pl-6 [&_ol]:my-2">
          {source.content}
        </span>
      </PopoverContent>
    </Popover>
  );
}

// Pre-formatter to convert standard [^1] style markdown citations to markdown links: [1](citation-1)
export const formatCitationLinks = (content: string) => {
  return content.replace(/\[\^(\d+)\]/g, "[$1](citation-$1)");
};
