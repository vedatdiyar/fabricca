import { eq, and, desc } from "drizzle-orm";
import { db } from "@/core/db";
import {
  sessions,
  messages,
  outlines,
  annotations,
  sources,
  outlineAnnotations,
  outlineSources,
} from "@/core/db/schema";
import { ThinkingLevel } from "@google/genai";
import { generateGeminiStructuredContent } from "@/core/services/ai";
import { FLASH_LITE_35 } from "@/lib/constants";
import { createFlowId, Logger } from "@/lib/logger";
import {
  performHybridRagSearch,
  type RagSearchResultItem,
} from "@/core/services/search/rag-search";
import {
  citationAuditJsonSchema,
  editorialPolishJsonSchema,
  juryCritiquesJsonSchema,
  buildCitationAuditPromptPayload,
  buildEditorialPolishPromptPayload,
  buildJuryCritiquesPromptPayload,
  type OfficeReviewPromptInput,
} from "../_prompts/office-review.prompt";
import type {
  OfficeReviewReport,
  PipelineResultData,
  JuryCritique,
} from "./pipeline/types";
import { formatRagSourceContext } from "./pipeline/context";

export interface RunOfficeReviewInput {
  userId: number;
  outlineId: number;
  draftText: string;
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
async function loadSectionContext(userId: number, outlineId: number) {
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
    notesCount: allAnnotationRows.length,
  };
}

/**
 * Task 1: Runs specialized citation, fact-checking, and page audit with timing metrics.
 */
async function runCitationAuditTask(
  params: OfficeReviewPromptInput,
): Promise<{ data: OfficeReviewReport["audit"]; durationMs: number }> {
  console.log(
    "  ▶ [Task 1/3 - Citation Audit] Gemini (Flash Lite 3.5 - Low) started...",
  );
  const start = performance.now();
  const payload = buildCitationAuditPromptPayload(params);
  const data = await generateGeminiStructuredContent<
    OfficeReviewReport["audit"]
  >(
    FLASH_LITE_35,
    payload.systemInstruction,
    payload.userPrompt,
    citationAuditJsonSchema,
    undefined,
    {
      payloadStage: "advisor_citation_audit",
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  );
  const durationMs = Math.round(performance.now() - start);
  console.log(`  ✓ [Task 1/3 - Citation Audit] Finished in ${durationMs}ms`);
  return {
    data,
    durationMs,
  };
}

/**
 * Task 2: Runs specialized non-destructive editorial polish and diff with timing metrics.
 */
async function runEditorialPolishTask(
  params: OfficeReviewPromptInput,
): Promise<{ data: OfficeReviewReport["diff"]; durationMs: number }> {
  console.log(
    "  ▶ [Task 2/3 - Editorial Polish] Gemini (Flash Lite 3.5 - Minimal) started...",
  );
  const start = performance.now();
  const payload = buildEditorialPolishPromptPayload(params);
  const data = await generateGeminiStructuredContent<
    OfficeReviewReport["diff"]
  >(
    FLASH_LITE_35,
    payload.systemInstruction,
    payload.userPrompt,
    editorialPolishJsonSchema,
    undefined,
    {
      payloadStage: "advisor_editorial_polish",
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
    },
  );
  const durationMs = Math.round(performance.now() - start);
  console.log(`  ✓ [Task 2/3 - Editorial Polish] Finished in ${durationMs}ms`);
  return {
    data,
    durationMs,
  };
}

/**
 * Task 3: Runs specialized jury critique formulation with timing metrics.
 */
async function runJuryCritiquesTask(
  params: OfficeReviewPromptInput,
): Promise<{ data: { juryCritiques: JuryCritique[] }; durationMs: number }> {
  console.log(
    "  ▶ [Task 3/3 - Jury Critiques] Gemini (Flash Lite 3.5 - Low) started...",
  );
  const start = performance.now();
  const payload = buildJuryCritiquesPromptPayload(params);
  const data = await generateGeminiStructuredContent<{
    juryCritiques: JuryCritique[];
  }>(
    FLASH_LITE_35,
    payload.systemInstruction,
    payload.userPrompt,
    juryCritiquesJsonSchema,
    undefined,
    {
      payloadStage: "advisor_jury_critiques",
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  );
  const durationMs = Math.round(performance.now() - start);
  console.log(`  ✓ [Task 3/3 - Jury Critiques] Finished in ${durationMs}ms`);
  return {
    data,
    durationMs,
  };
}

/**
 * Runs Danışmanın Çalışma Odası Stage 1 Review:
 * 1. Hybrid RAG retrieval + Outline/Annotation Grounding.
 * 2. 3 Concurrent (Parallel) LLM Tasks via Promise.all with real-time start/end logs:
 *    - Task 1: Ultra-strict Citation & Page Auditor (Red Pen)
 *    - Task 2: Non-destructive Editorial Polish Stylist (Yellow Pen)
 *    - Task 3: Senior Defense Jury Challenger (Blue Pen)
 * 3. Immediate DB persistence into `sessions` and `messages`.
 *
 * @param input - userId, outlineId, draftText.
 * @returns Saved sessionId, aggregated reviewReport, and retrieved sources.
 */
export async function runOfficeReview(
  input: RunOfficeReviewInput,
): Promise<RunOfficeReviewOutput> {
  const { userId, outlineId, draftText } = input;
  const logger = new Logger(createFlowId());
  const overallStart = performance.now();

  console.log(`\n🔵 [Advisor Review] >>> STARTING STAGE 1 REVIEW`);
  console.log(
    `   Outline ID: ${outlineId} | Draft length: ${draftText.length} chars (~${draftText.trim().split(/\s+/).length} words)`,
  );

  // Step 1: Load section context & notes
  const step1Start = performance.now();
  const { outline, pinnedSourceIds, notesContext, notesCount } =
    await loadSectionContext(userId, outlineId);
  const step1Duration = Math.round(performance.now() - step1Start);
  console.log(
    `📦 [Advisor Step 1/3] Context loaded in ${step1Duration}ms (Outline: "${outline?.title || "N/A"}", Pinned Sources: ${pinnedSourceIds.length}, Notes: ${notesCount})`,
  );

  // Step 2: Hybrid RAG Search
  console.log(
    `🔍 [Advisor Step 2/3] Running Hybrid RAG search (Cloudflare BGE-M3 + Neon pgvector + Cohere Rerank)...`,
  );
  const step2Start = performance.now();
  const ragSources = await performHybridRagSearch({
    query: draftText,
    resourceIds: pinnedSourceIds.length > 0 ? pinnedSourceIds : undefined,
    topK: 7,
  });
  const step2Duration = Math.round(performance.now() - step2Start);
  console.log(
    `✅ [Advisor Step 2/3] Hybrid RAG finished in ${step2Duration}ms (Retrieved ${ragSources.length} relevant chunks)`,
  );

  const ragContext =
    ragSources.length === 0
      ? "Kütüphanenizde bu taslakla ilgili doğrudan eşleşen kaynak parçası bulunamadı."
      : formatRagSourceContext(ragSources, { includeRangeNote: true });

  const promptInput: OfficeReviewPromptInput = {
    draftText,
    outlineTitle: outline?.title || "Tez Bölümü",
    outlineDescription: outline?.description || undefined,
    ragContext,
    notesContext,
  };

  logger.info("Starting concurrent parallel office review tasks", {
    service: "advisor",
    step: "office_review_parallel_start",
    data: {
      userId,
      outlineId,
      draftWordCount: draftText.trim().split(/\s+/).length,
      ragSourcesCount: ragSources.length,
    },
  });

  console.log(
    `⚡ [Advisor Step 3/3] DISPATCHING 3 CONCURRENT GEMINI TASKS (Promise.all)...`,
  );

  // Run all 3 specialized LLM tasks concurrently in parallel
  const [auditRes, diffRes, juryRes] = await Promise.all([
    runCitationAuditTask(promptInput),
    runEditorialPolishTask(promptInput),
    runJuryCritiquesTask(promptInput),
  ]);

  const totalDurationMs = Math.round(performance.now() - overallStart);

  logger.info("Parallel office review completed successfully", {
    service: "advisor",
    step: "office_review_parallel_completed",
    durationMs: totalDurationMs,
    data: {
      step1Duration,
      step2Duration,
      citationAuditDurationMs: auditRes.durationMs,
      editorialPolishDurationMs: diffRes.durationMs,
      juryCritiquesDurationMs: juryRes.durationMs,
    },
  });

  console.log(
    `🏁 [Advisor Review] >>> ALL COMPLETED in ${totalDurationMs}ms | Audit: ${auditRes.durationMs}ms | Polish: ${diffRes.durationMs}ms | Jury: ${juryRes.durationMs}ms\n`,
  );

  const reviewReport: OfficeReviewReport = {
    audit: auditRes.data,
    diff: diffRes.data,
    juryCritiques: juryRes.data.juryCritiques,
    outlineId,
    draftText,
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
    })
    .returning({ id: sessions.id });

  const pipelineData: PipelineResultData = {
    stage: "office_review",
    outlineId,
    draftText,
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
