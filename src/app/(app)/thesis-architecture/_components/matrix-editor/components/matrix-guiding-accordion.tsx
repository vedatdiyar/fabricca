"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

interface MatrixGuidingAccordionProps {
  questions: string[];
}

/**
 * Self-contained accordion that lists the academic guiding questions of a
 * matrix pillar; its expanded/collapsed state is managed independently.
 *
 * @param root0 - Component props.
 * @param root0.questions - The guiding questions to display when expanded.
 */
export function MatrixGuidingAccordion({
  questions,
}: MatrixGuidingAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-md border border-border/40 bg-card/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between p-2.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5 text-primary" />
          <span>Akademik Rehber Sorular ve İpuçları</span>
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          {isOpen ? "Gizle ▲" : "Göster ▼"}
        </span>
      </button>
      {isOpen && (
        <div className="p-3 pt-1 border-t border-border/40 bg-muted/15 space-y-1.5">
          {questions.map((q, qIdx) => (
            <div
              key={`question-${qIdx}-${q.slice(0, 10)}`}
              className="flex items-start gap-2 text-xs text-muted-foreground"
            >
              <span className="text-primary font-bold">•</span>
              <span>{q}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
