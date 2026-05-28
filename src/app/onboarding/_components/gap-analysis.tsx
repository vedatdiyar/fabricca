"use client";

import React from "react";
import { Sparkles, Target, Layers } from "lucide-react";

interface GapAnalysisSectionProps {
  gapAnalysis: string;
}

export function GapAnalysisSection({ gapAnalysis }: GapAnalysisSectionProps) {
  function parseSections(text: string) {
    const sectionRegex = /(\d+[.)]\s*[^:]+?:)/g;
    const parts = text.split(sectionRegex);
    const intro = parts[0]?.trim() || "";
    const sections: { heading: string; body: string }[] = [];
    for (let i = 1; i < parts.length - 1; i += 2) {
      const heading = parts[i]?.trim() || "";
      const body = parts[i + 1]?.trim() || "";
      if (heading && body) {
        sections.push({ heading, body });
      }
    }
    return { intro, sections };
  }

  const { intro, sections } = parseSections(gapAnalysis);

  if (sections.length === 0) {
    return (
      <div className="bg-card/50 border border-border p-3 rounded-lg shadow-sm text-xs text-foreground leading-relaxed font-sans">
        {gapAnalysis}
      </div>
    );
  }

  function getIcon(heading: string, index: number) {
    if (heading.includes("Teorik") || heading.includes("Kavramsallaştırma"))
      return <Sparkles className="h-4 w-4 text-primary shrink-0" />;
    if (heading.includes("Stratejik") || heading.includes("Müdahale"))
      return <Target className="h-4 w-4 text-primary shrink-0" />;
    if (
      heading.includes("Metodolojik") ||
      heading.includes("Mekansal") ||
      heading.includes("Mekânsal")
    )
      return <Layers className="h-4 w-4 text-primary shrink-0" />;
    const fallbackIcons = [Sparkles, Target, Layers];
    const Icon = fallbackIcons[index] || Sparkles;
    return <Icon className="h-4 w-4 text-primary shrink-0" />;
  }

  return (
    <div className="space-y-3">
      {intro && (
        <p className="border-l-2 border-primary pl-3 text-xs text-muted-foreground leading-relaxed font-sans">
          {intro}
        </p>
      )}
      <ul className="space-y-3">
        {sections.map((section, idx) => (
          <li
            key={`gap_${idx}`}
            className="bg-card/50 border border-border p-3 rounded-lg shadow-sm"
          >
            <div className="flex items-start gap-2.5">
              {getIcon(section.heading, idx)}
              <div className="min-w-0 flex-1 space-y-1">
                <span className="font-semibold text-primary block text-xs">
                  {section.heading}
                </span>
                <p className="text-xs text-foreground leading-relaxed font-sans">
                  {section.body}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
