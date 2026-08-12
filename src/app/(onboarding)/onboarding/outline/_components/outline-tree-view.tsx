"use client";

import { BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AIBanner } from "@/components/shared/ai-banner";

interface OutlineSection {
  title: string;
  description: string;
  sortOrder: number;
  subSections?: Array<{
    title: string;
    description: string;
    sortOrder: number;
  }>;
}

interface OutlineTreeViewProps {
  sections: OutlineSection[];
}

function OutlineSectionNode({
  section,
  index,
}: {
  section: OutlineSection;
  index: number;
}) {
  const hasSubSections = section.subSections && section.subSections.length > 0;
  const sectionNumber = section.sortOrder || index + 1;

  return (
    <Card className="rounded-md border border-border/40 p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-bold text-primary">
          {sectionNumber}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-lg font-medium tracking-tight text-foreground leading-snug">
            {section.title}
          </h3>
          {section.description && (
            <p className="text-xs text-muted-foreground leading-relaxed mt-1">
              {section.description}
            </p>
          )}
        </div>
        {hasSubSections && (
          <BookOpen className="size-4 mt-1 shrink-0 text-muted-foreground" />
        )}
      </div>

      {hasSubSections && (
        <div className="ml-6 mt-3 pl-4 border-l-2 border-primary/20 flex flex-col gap-3">
          {section.subSections!.map((sub, subIdx) => (
            <div key={`${sub.title}-${subIdx}`} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded shrink-0">
                  {sectionNumber}.{sub.sortOrder || subIdx + 1}
                </span>
                <h4 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground leading-snug">
                  {sub.title}
                </h4>
              </div>
              {sub.description && (
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  {sub.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function OutlineTreeView({ sections }: OutlineTreeViewProps) {
  return (
    <div className="w-full flex flex-col gap-6">
      <AIBanner
        icon={BookOpen}
        title="Tez Planı Oluşturuldu"
        description="Tez matrisiniz analiz edilerek bölüm ve alt bölüm yapısı oluşturuldu. Aşağıdaki planı inceleyerek devam edebilirsiniz."
      />

      <div className="flex flex-col gap-1">
        {sections
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((section, idx) => (
            <OutlineSectionNode
              key={`${section.title}-${idx}`}
              section={section}
              index={idx}
            />
          ))}
      </div>
    </div>
  );
}
