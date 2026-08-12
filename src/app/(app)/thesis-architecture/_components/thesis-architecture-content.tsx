"use client";

import { useState } from "react";
import { Matrix, Box, Outline, Annotation, Source } from "@/db/schema";
import { MatrixEditorView } from "./matrix-editor-view";
import { BoxManagerView } from "./box-manager-view";
import { OutlineEditorView } from "./outline-editor-view";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Network, Target, FolderKanban, BookOpen } from "lucide-react";

interface ThesisArchitectureContentProps {
  matrix: Matrix;
  boxesList: Box[];
  outlinesList: Outline[];
  annotationsList: (Annotation & { source?: Source })[];
  pinnedMap: Record<number, number[]>;
  linkedBoxMap: Record<number, number[]>;
}

export function ThesisArchitectureContent({
  matrix,
  boxesList,
  outlinesList,
  annotationsList,
  pinnedMap,
  linkedBoxMap,
}: ThesisArchitectureContentProps) {
  const [activeTab, setActiveTab] = useState("matrix");

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/20">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Tez Mimarisi
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Tez Matrisi, Konu Kutuları ve Bölüm Planı&apos;nı araştırma ve
                okuma süreciniz boyunca canlı olarak yönetin.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md bg-muted/60 p-1">
          <TabsTrigger value="matrix" className="gap-2 text-xs sm:text-sm">
            <Target className="h-4 w-4" />
            <span>Tez Matrisi</span>
          </TabsTrigger>
          <TabsTrigger value="boxes" className="gap-2 text-xs sm:text-sm">
            <FolderKanban className="h-4 w-4" />
            <span>Konu Kutuları</span>
          </TabsTrigger>
          <TabsTrigger value="outline" className="gap-2 text-xs sm:text-sm">
            <BookOpen className="h-4 w-4" />
            <span>Bölüm Planı</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="mt-6 space-y-4">
          <MatrixEditorView initialMatrix={matrix} />
        </TabsContent>

        <TabsContent value="boxes" className="mt-6 space-y-4">
          <BoxManagerView boxesList={boxesList} />
        </TabsContent>

        <TabsContent value="outline" className="mt-6 space-y-4">
          <OutlineEditorView
            outlinesList={outlinesList}
            boxesList={boxesList}
            annotationsList={annotationsList}
            pinnedMap={pinnedMap}
            linkedBoxMap={linkedBoxMap}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
