"use client";

import { BookOpen } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { LibraryResource } from "@/db/schema";

interface ReaderResourceListProps {
  resources: LibraryResource[];
  isPending: boolean;
  onToggle: (resourceId: number, isRead: boolean) => void;
}

export function ReaderResourceList({
  resources,
  isPending,
  onToggle,
}: ReaderResourceListProps) {
  return (
    <ScrollArea className="max-h-[520px] w-full">
      <div className="flex flex-col gap-0">
        {resources.map((resource, index) => (
          <div
            key={resource.id}
            className={`flex items-start gap-4 border-b border-border/40 px-6 py-4 transition-colors hover:bg-muted/20 ${
              resource.isRead ? "opacity-70" : ""
            }`}
          >
            <Checkbox
              id={`resource-${resource.id}`}
              checked={resource.isRead === true}
              onCheckedChange={(checked) => {
                onToggle(resource.id, checked === true);
              }}
              disabled={isPending}
              className="mt-1 shrink-0"
              aria-label={
                resource.isRead
                  ? "Okundu olarak işaretle"
                  : "Okunmadı olarak işaretle"
              }
            />

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <label
                  htmlFor={`resource-${resource.id}`}
                  className="cursor-pointer text-sm font-medium text-foreground leading-snug hover:text-primary transition-colors line-clamp-2 break-words hyphens-auto"
                >
                  {resource.title}
                </label>
                {resource.badge && (
                  <Badge variant="outline">{resource.badge}</Badge>
                )}
              </div>

              {resource.authors && resource.authors.length > 0 && (
                <p className="text-xs text-muted-foreground truncate">
                  {resource.authors.join(", ")}
                  {resource.publicationYear
                    ? ` — ${resource.publicationYear}`
                    : ""}
                </p>
              )}

              {resource.comparisonNote && (
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 whitespace-pre-line">
                  {resource.comparisonNote}
                </p>
              )}

              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <BookOpen className="h-3 w-3" />
                Kaynak #{index + 1}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
