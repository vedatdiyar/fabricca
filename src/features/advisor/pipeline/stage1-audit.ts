import { eq, desc, and } from "drizzle-orm";
import { db } from "@/db";
import { annotations, sources } from "@/db/schema";
import {
  performHybridRagSearch,
  type RagSearchResultItem,
} from "@/services/search/rag-search";
import { ThinkingLevel } from "@google/genai";
import { generateGeminiStructuredContent } from "@/services/ai";
import { FLASH_LITE_35 } from "@/lib/constants";
import { buildPipelineStage1AuditSystemInstruction } from "@/lib/prompts";
import {
  auditReportJsonSchema,
  auditReportSchema,
  type AuditReport,
} from "./types";
import { formatRagSourceContext } from "./context";

/**
 * Loads recent user annotations joined with their source metadata for grounding.
 *
 * @param userId - The ID of the authenticated user.
 * @returns The rendered Turkish annotation context string.
 */
export async function loadAnnotationContext(userId: number): Promise<string> {
  const rows = await db
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
    .where(and(eq(annotations.userId, userId)))
    .orderBy(desc(annotations.createdAt))
    .limit(30);

  if (rows.length === 0) {
    return "Kütüphanenizde henüz öğrenci notu/alıntısı bulunmamaktadır.";
  }

  return rows
    .map((row) => {
      const authors = row.sourceAuthors?.join(", ") ?? "Bilinmiyor";
      const year = row.sourceYear ? ` (${row.sourceYear})` : "";
      return `- [${row.noteType}] "${row.sourceTitle}"${year} | ${authors} | s. ${row.pageNumber}\n  İçerik: ${row.content}`;
    })
    .join("\n\n");
}

/**
 * Runs Stage 1 of the academic pipeline: retrieves the user's uploaded source chunks,
 * loads their annotations, and produces a strict zero-hallucination audit report.
 *
 * @param userId - The ID of the authenticated user.
 * @param draft - The user's draft paragraph text to audit.
 * @returns The audit report plus the RAG sources and rendered contexts used as grounding.
 */
export async function runStage1Audit(
  userId: number,
  draft: string,
): Promise<{
  audit: AuditReport;
  sources: RagSearchResultItem[];
  sourceContext: string;
  annotationContext: string;
}> {
  const sources = await performHybridRagSearch({ query: draft, topK: 7 });

  const sourceContext =
    sources.length === 0
      ? "Kütüphanenizde bu taslakla ilgili doğrudan eşleşen kaynak bulunamadı."
      : formatRagSourceContext(sources, { includeRangeNote: true });

  const annotationContext = await loadAnnotationContext(userId);

  const audit = await generateGeminiStructuredContent<AuditReport>(
    FLASH_LITE_35,
    buildPipelineStage1AuditSystemInstruction(),
    `Kütüphane Kaynak Bağlamı:\n${sourceContext}\n\nKullanıcı Notları Bağlamı:\n${annotationContext}\n\nDenetlenecek Taslak Metin:\n"""\n${draft}\n"""`,
    auditReportJsonSchema,
    undefined,
    {
      zodSchema: auditReportSchema,
      payloadStage: "advisor_pipeline_stage1_audit",
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  );

  return { audit, sources, sourceContext, annotationContext };
}
