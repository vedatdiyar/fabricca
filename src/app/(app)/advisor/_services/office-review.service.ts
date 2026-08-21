import { eq, and, desc } from "drizzle-orm";
import { db } from "@/core/db";
import {
  outlines,
  outlineSources,
  outlineAnnotations,
  annotations,
  sources,
  sessions,
  messages,
} from "@/core/db/schema";
import {
  performHybridRagSearch,
  type RagSearchResultItem,
} from "@/core/services/search/rag-search";
import { generateGeminiStructuredContent } from "@/core/services/ai";
import { FLASH_36 } from "@/lib/constants";
import {
  buildOfficeReviewPromptPayload,
  officeReviewJsonSchema,
} from "../_prompts/office-review.prompt";
import type {
  OfficeReviewReport,
  PipelineResultData,
} from "./pipeline/types";
import { formatRagSourceContext } from "./pipeline/context";

export interface RunOfficeReviewInput {
  userId: number;
  outlineId: number;
  draftText: string;
  studentNote?: string;
}

export interface RunOfficeReviewOutput {
  sessionId: number;
  reviewReport: OfficeReviewReport;
  sources: RagSearchResultItem[];
}

/**
 * Loads outline metadata, section-pinned annotations, and general user notes for grounding.
 *
 * @param userId - User ID.
 * @param outlineId - Selected Outline Section ID.
 * @returns Outline info and rendered annotations context.
 */
async function loadSectionContext(
  userId: number,
  outlineId: number,
) {
  const [outline] = await db
    .select({
      id: outlines.id,
      title: outlines.title,
      description: outlines.description,
    })
    .from(outlines)
    .where(eq(outlines.id, outlineId))
    .limit(1);

  // 1. Section pinned annotations
  const pinnedRows = await db
    .select({
      content: annotations.content,
      pageNumber: annotations.pageNumber,
      noteType: annotations.noteType,
      sourceTitle: sources.title,
      sourceAuthors: sources.authors,
      sourceYear: sources.publicationYear,
    })
    .from(outlineAnnotations)
    .innerJoin(annotations, eq(outlineAnnotations.annotationId, annotations.id))
    .innerJoin(sources, eq(annotations.sourceId, sources.id))
    .where(
      and(
        eq(outlineAnnotations.outlineId, outlineId),
        eq(annotations.userId, userId),
      ),
    );

  // 2. Section pinned source IDs for focused RAG
  const pinnedSourceRows = await db
    .select({ sourceId: outlineSources.sourceId })
    .from(outlineSources)
    .where(eq(outlineSources.outlineId, outlineId));

  const pinnedSourceIds = pinnedSourceRows.map((r) => r.sourceId);

  // 3. Fallback recent user annotations if pinned annotations are sparse
  let allAnnotationRows = pinnedRows;
  if (allAnnotationRows.length < 5) {
    const recentRows = await db
      .select({
        content: annotations.content,
        pageNumber: annotations.pageNumber,
        noteType: annotations.noteType,
        sourceTitle: sources.title,
        sourceAuthors: sources.authors,
        sourceYear: sources.publicationYear,
      })
      .from(annotations)
      .innerJoin(sources, eq(annotations.sourceId, sources.id))
      .where(eq(annotations.userId, userId))
      .orderBy(desc(annotations.createdAt))
      .limit(20);

    allAnnotationRows = [...pinnedRows, ...recentRows];
  }

  const notesContext =
    allAnnotationRows.length === 0
      ? "Kütüphanenizde bu bölüm için henüz alıntı fişi/not bulunmamaktadır."
      : allAnnotationRows
          .slice(0, 25)
          .map((row) => {
            const authors = row.sourceAuthors?.join(", ") ?? "Bilinmiyor";
            const year = row.sourceYear ? ` (${row.sourceYear})` : "";
            return `- [${row.noteType}] "${row.sourceTitle}"${year} | ${authors} | s. ${row.pageNumber}\n  İçerik: ${row.content}`;
          })
          .join("\n\n");

  return {
    outline,
    pinnedSourceIds,
    notesContext,
  };
}

/**
 * Runs Danışmanın Çalışma Odası Stage 1 Review:
 * 1. Hybrid RAG retrieval + Outline/Annotation Grounding.
 * 2. LLM 3-part structured audit (Red pen Citation check, Yellow pen Non-destructive Diff, Blue pen Jury Critiques).
 * 3. Immediate DB persistence into `sessions` and `messages`.
 *
 * @param input - userId, outlineId, draftText, optional studentNote.
 * @returns Saved sessionId and structured reviewReport.
 */
export async function runOfficeReview(
  input: RunOfficeReviewInput,
): Promise<RunOfficeReviewOutput> {
  const { userId, outlineId, draftText, studentNote } = input;

  const { outline, pinnedSourceIds, notesContext } =
    await loadSectionContext(userId, outlineId);

  // Run Hybrid RAG (prioritize section pinned sources if available, otherwise search library)
  const ragSources = await performHybridRagSearch({
    query: draftText,
    resourceIds: pinnedSourceIds.length > 0 ? pinnedSourceIds : undefined,
    topK: 7,
  });

  const ragContext =
    ragSources.length === 0
      ? "Kütüphanenizde bu taslakla ilgili doğrudan eşleşen kaynak parçası bulunamadı."
      : formatRagSourceContext(ragSources, { includeRangeNote: true });

  const payload = buildOfficeReviewPromptPayload({
    draftText,
    outlineTitle: outline?.title || "Tez Bölümü",
    outlineDescription: outline?.description || undefined,
    ragContext,
    notesContext,
    studentNote,
  });

  const reviewResult = await generateGeminiStructuredContent<OfficeReviewReport>(
    FLASH_36,
    payload.systemInstruction,
    payload.userPrompt,
    officeReviewJsonSchema,
    undefined,
    {
      payloadStage: "advisor_office_review",
    },
  );

  const reviewReport: OfficeReviewReport = {
    ...reviewResult,
    outlineId,
    draftText,
    studentNote,
  };

  const sessionTitle = outline?.title
    ? `Taslak: ${outline.title.slice(0, 35)}...`
    : `Taslak İncelemesi: ${draftText.slice(0, 30)}...`;

  // Persist review in database
  const [createdSession] = await db
    .insert(sessions)
    .values({
      userId,
      outlineId,
      title: sessionTitle,
      draftText,
      studentNote,
    })
    .returning({ id: sessions.id });

  const pipelineData: PipelineResultData = {
    stage: "office_review",
    outlineId,
    draftText,
    studentNote,
    audit: reviewReport.audit,
    diff: reviewReport.diff,
    juryCritiques: reviewReport.juryCritiques,
  };

  await db.insert(messages).values({
    sessionId: createdSession.id,
    role: "assistant",
    persona: "advisor",
    content: reviewReport.audit.summary,
    sources: ragSources,
    pipelineData,
  });

  return {
    sessionId: createdSession.id,
    reviewReport,
    sources: ragSources,
  };
}
