"use client";

import React from "react";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Thesis {
  id: number | string;
  title: string;
  author: string;
  university: string;
  year: number | string;
  abstract?: string;
  abstract_en?: string;
}

export function ThesisRow({ thesis }: { thesis: Thesis }) {
  return (
    <AccordionItem
      value={`thesis-${thesis.id}`}
      className="border border-border bg-secondary/30 rounded-lg overflow-hidden transition-all duration-300 px-3 border-b-0"
    >
      <AccordionTrigger className="hover:no-underline py-3 cursor-pointer select-none">
        <div className="min-w-0 flex-1 space-y-1 text-left">
          <p className="text-xs font-semibold text-foreground line-clamp-2 leading-tight">
            {thesis.title}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground font-mono">
            <span className="font-semibold text-primary">{thesis.author}</span>
            <span>•</span>
            <span>{thesis.university}</span>
            <span>•</span>
            <span>{thesis.year}</span>
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="pt-2 pb-4 text-muted-foreground border-t border-border mt-1">
        {thesis.abstract ? (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-primary uppercase font-mono tracking-wider">
              Tez Özeti (Türkçe)
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed font-sans select-text">
              {thesis.abstract}
            </p>
          </div>
        ) : thesis.abstract_en ? (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-primary uppercase font-mono tracking-wider">
              Thesis Abstract (English)
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed font-sans select-text">
              {thesis.abstract_en}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic select-text">
            Bu tezin özeti bulunmamaktadır.
          </p>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
