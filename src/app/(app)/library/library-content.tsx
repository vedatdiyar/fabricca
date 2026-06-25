"use client";

import { useState } from "react";
import { Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LiteratureReader } from "@/components/literature-reader";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ThesisBox } from "@/db/schema";

interface LibraryContentProps {
  boxes: ThesisBox[];
}

export function LibraryContent({ boxes }: LibraryContentProps) {
  const [selectedBoxId, setSelectedBoxId] = useState<number>(boxes[0]?.id ?? 0);

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
    <div>
      <h1 className="sr-only font-serif text-2xl font-bold tracking-tight text-foreground">
        Kütüphane
      </h1>
      <div className="flex h-[calc(100vh-10rem)] gap-6">
        {/* Left sidebar — box list */}
        <aside className="hidden w-72 shrink-0 md:block">
          <Card className="flex h-full flex-col rounded-md">
            <div className="border-b border-border/40 px-4 py-3">
              <h3 className="font-serif text-lg font-medium tracking-tight text-foreground">
                Konu Kutuları
              </h3>
            </div>

            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-2 p-2">
                {boxes.map((box) => (
                  <button
                    key={box.id}
                    onClick={() => setSelectedBoxId(box.id)}
                    className={`w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                      box.id === selectedBoxId
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                    }`}
                  >
                    <span className="line-clamp-2 leading-snug">
                      {box.title}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </aside>

        {/* Mobile selector */}
        <div className="w-full md:hidden">
          <select
            aria-label="Konu kutusu seç"
            value={selectedBoxId}
            onChange={(e) => setSelectedBoxId(Number(e.target.value))}
            className="mb-4 w-full rounded-md border border-border bg-card px-4 py-2.5 text-sm text-card-foreground"
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
              boxType={selectedBox.boxType}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Bir konu kutusu seçin.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
