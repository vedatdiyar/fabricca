import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/core/db";
import {
  matrices,
  boxes,
  outlines,
  annotations,
  sources,
  outlineAnnotations,
  outlineSources,
} from "@/core/db/schema";
import { eq, inArray } from "drizzle-orm";
import { OutlineEditorView } from "../_components/outline-editor";
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
      <div className="w-full space-y-6">
        <Card className="flex flex-col items-center justify-center rounded-md border border-dashed border-border/40 p-8 text-center bg-card">
          <p className="font-serif text-sm font-semibold tracking-tight text-foreground">
            Tez matrisi henüz oluşturulmadı
          </p>
          <p className="mt-1 font-sans text-xs text-muted-foreground">
            Lütfen onboarding adımlarını tamamlayın.
          </p>
        </Card>
      </div>
    );
  }

  const userBoxes = await db.query.boxes.findMany({
    where: eq(boxes.matrixId, userMatrix.id),
  });

  const userOutlines = await db.query.outlines.findMany({
    where: eq(outlines.matrixId, userMatrix.id),
  });

  const userSources = await db.query.sources.findMany({
    where: inArray(
      sources.boxId,
      userBoxes.map((b) => b.id),
    ),
  });

  const sourceMap = new Map<number, typeof sources.$inferSelect>();
  for (const s of userSources) {
    sourceMap.set(s.id, s);
  }

  // Fetch user's annotations
  const userAnnotationsRaw = await db.query.annotations.findMany({
    where: eq(annotations.userId, session.userId),
  });

  // If any annotations reference sources outside userBoxes, fetch them too
  const missingSourceIds = userAnnotationsRaw
    .map((a) => a.sourceId)
    .filter((id): id is number => Boolean(id) && !sourceMap.has(id));

  if (missingSourceIds.length > 0) {
    const additionalSources = await db.query.sources.findMany({
      where: inArray(sources.id, missingSourceIds),
    });
    for (const s of additionalSources) {
      sourceMap.set(s.id, s);
    }
  }

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

  // Fetch outlineSources junction records
  const linkedSourceRecords =
    outlineIds.length > 0
      ? await db.query.outlineSources.findMany({
          where: inArray(outlineSources.outlineId, outlineIds),
        })
      : [];

  const linkedSourcesMap: Record<number, number[]> = {};
  for (const rec of linkedSourceRecords) {
    if (!linkedSourcesMap[rec.outlineId]) linkedSourcesMap[rec.outlineId] = [];
    linkedSourcesMap[rec.outlineId].push(rec.sourceId);
  }

  return (
    <div className="w-full space-y-6">
      {/* Main Outline Editor View */}
      <OutlineEditorView
        outlinesList={userOutlines}
        sourcesList={Array.from(sourceMap.values())}
        annotationsList={annotationsWithSources}
        pinnedMap={pinnedMap}
        linkedSourcesMap={linkedSourcesMap}
      />
    </div>
  );
}
