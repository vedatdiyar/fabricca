"use client";

import { useState } from "react";
import { Matrix, Box, Outline, Annotation, Source } from "@/db/schema";
import { MatrixEditorView } from "./matrix-editor";
import { BoxManagerView } from "./box-manager";
import { OutlineEditorView } from "./outline-editor";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Target, FolderKanban, BookOpen } from "lucide-react";

interface ThesisArchitectureContentProps {
  matrix: Matrix;
  boxesList: Box[];
  outlinesList: Outline[];
  sourcesList?: Source[];
  annotationsList: (Annotation & { source?: Source })[];
  pinnedMap: Record<number, number[]>;
  linkedBoxMap: Record<number, number[]>;
}

export function ThesisArchitectureContent({
  matrix,
  boxesList,
  outlinesList,
  sourcesList = [],
  annotationsList,
  pinnedMap,
  linkedBoxMap,
}: ThesisArchitectureContentProps) {
  const [activeTab, setActiveTab] = useState("matrix");

  return (
    <div className="w-full space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
          <TabsList className="grid w-full sm:w-auto grid-cols-3 max-w-md bg-muted/60 p-1">
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

          <div
            id="thesis-tab-actions"
            className="flex items-center gap-2 justify-end shrink-0"
          />
        </div>

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
            sourcesList={sourcesList}
            annotationsList={annotationsList}
            pinnedMap={pinnedMap}
            linkedBoxMap={linkedBoxMap}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
