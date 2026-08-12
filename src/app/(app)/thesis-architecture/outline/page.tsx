export const instant = false;

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import {
  matrices,
  boxes,
  outlines,
  annotations,
  sources,
  outlineAnnotations,
  outlineBoxes,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { OutlineEditorView } from "../_components/outline-editor-view";
import { Card } from "@/components/ui/card";

export default async function ThesisOutlinePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const userMatrix = await db.query.matrices.findFirst({
    where: eq(matrices.userId, session.userId),
  });

  if (!userMatrix) {
    return (
      <Card className="flex flex-col items-center justify-center rounded-md border border-dashed border-border/40 p-8 text-center">
        <p className="font-sans text-lg font-medium tracking-tight text-foreground">
          Tez matrisi henüz oluşturulmadı
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Lütfen onboarding adımlarını tamamlayın.
        </p>
      </Card>
    );
  }

  const userBoxes = await db.query.boxes.findMany({
    where: eq(boxes.matrixId, userMatrix.id),
  });

  const userOutlines = await db.query.outlines.findMany({
    where: eq(outlines.matrixId, userMatrix.id),
  });

  // Fetch all sources for user's boxes
  const boxIds = userBoxes.map((b) => b.id);
  const userSources =
    boxIds.length > 0
      ? await db.query.sources.findMany({
          where: inArray(sources.boxId, boxIds),
        })
      : [];

  const sourceMap = new Map(userSources.map((s) => [s.id, s]));

  // Fetch user's annotations
  const userAnnotationsRaw = await db.query.annotations.findMany({
    where: eq(annotations.userId, session.userId),
  });

  const annotationsWithSources = userAnnotationsRaw.map((anno) => ({
    ...anno,
    source: sourceMap.get(anno.sourceId),
  }));

  // Fetch outlineAnnotations junction records
  const outlineIds = userOutlines.map((o) => o.id);
  const pinnedRecords =
    outlineIds.length > 0
      ? await db.query.outlineAnnotations.findMany({
          where: inArray(outlineAnnotations.outlineId, outlineIds),
        })
      : [];

  const pinnedMap: Record<number, number[]> = {};
  for (const rec of pinnedRecords) {
    if (!pinnedMap[rec.outlineId]) pinnedMap[rec.outlineId] = [];
    pinnedMap[rec.outlineId].push(rec.annotationId);
  }

  // Fetch outlineBoxes junction records
  const linkedBoxRecords =
    outlineIds.length > 0
      ? await db.query.outlineBoxes.findMany({
          where: inArray(outlineBoxes.outlineId, outlineIds),
        })
      : [];

  const linkedBoxMap: Record<number, number[]> = {};
  for (const rec of linkedBoxRecords) {
    if (!linkedBoxMap[rec.outlineId]) linkedBoxMap[rec.outlineId] = [];
    linkedBoxMap[rec.outlineId].push(rec.boxId);
  }

  return (
    <OutlineEditorView
      outlinesList={userOutlines}
      boxesList={userBoxes}
      sourcesList={userSources}
      annotationsList={annotationsWithSources}
      pinnedMap={pinnedMap}
      linkedBoxMap={linkedBoxMap}
    />
  );
}
