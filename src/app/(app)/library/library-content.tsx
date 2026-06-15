"use client";

import { useState } from "react";
import { Layers } from "lucide-react";
import { LiteratureReader } from "@/components/literature-reader";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ThesisBox } from "@/db/schema";

interface LibraryContentProps {
  boxes: ThesisBox[];
}

export function LibraryContent({ boxes }: LibraryContentProps) {
  const [selectedBoxId, setSelectedBoxId] = useState<number>(
    boxes[0]?.id ?? 0
  );

  const selectedBox = boxes.find((b) => b.id === selectedBoxId);

  if (boxes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-muted/20 bg-muted/10">
          <Layers className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-lg font-medium text-foreground">
          Henüz hiç konu kutusu oluşturulmamış
        </p>
        <p className="text-sm text-muted-foreground">
          Lütfen önce onboarding sürecini tamamlayın.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] gap-6">
      {/* Left sidebar — box list */}
      <aside className="hidden w-72 shrink-0 md:block">
        <div className="flex h-full flex-col rounded-lg border border-border/20 bg-card">
          <div className="border-b border-border/10 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              Konu Kutuları
            </h3>
          </div>

          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-0.5 p-2">
              {boxes.map((box) => (
                <button
                  key={box.id}
                  onClick={() => setSelectedBoxId(box.id)}
                  className={`w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                    box.id === selectedBoxId
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                  }`}
                >
                  <span className="line-clamp-2 leading-snug">
                    {box.title}
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </aside>

      {/* Mobile selector */}
      <div className="w-full md:hidden">
        <select
          value={selectedBoxId}
          onChange={(e) => setSelectedBoxId(Number(e.target.value))}
          className="mb-4 w-full rounded-lg border border-border/20 bg-card px-4 py-2.5 text-sm text-foreground"
        >
          {boxes.map((box) => (
            <option key={box.id} value={box.id}>
              {box.title}
            </option>
          ))}
        </select>
      </div>

      {/* Main reader area */}
      <div className="flex-1 overflow-hidden">
        {selectedBox ? (
          <LiteratureReader
            key={selectedBox.id}
            boxId={selectedBox.id}
            boxTitle={selectedBox.title}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Bir konu kutusu seçin.</p>
          </div>
        )}
      </div>
    </div>
  );
}
