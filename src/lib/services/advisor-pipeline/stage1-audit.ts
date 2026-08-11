import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { annotations, sources, matrices, boxes } from "@/db/schema";
import {
  performHybridRagSearch,
  type RagSearchResultItem,
} from "@/lib/services/rag-search";
import { ThinkingLevel } from "@google/genai";
import {
  generateStructuredContent,
  type JsonSchema,
} from "@/lib/services/gemini";
import { FLASH_LITE_35 } from "@/lib/constants";
import { buildPipelineStage1AuditSystemInstruction } from "@/lib/prompts";
import type { AuditFinding, AuditReport } from "./types";

const auditFindingSchema = z.object({
  message: z.string(),
  severity: z.enum(["CRITICAL", "WARNING", "NOTE"]),
  sourceTitle: z.string().optional(),
  citedPages: z.string().optional(),
});

const auditReportSchema = z.object({
  summary: z.string(),
  findings: z.array(auditFindingSchema),
  hasCriticalIssues: z.boolean(),
});

const auditReportJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "Turkish summary of the overall Stage 1 audit verdict.",
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description:
              "Turkish description of the audit finding or confirmation.",
          },
          severity: {
            type: "string",
            enum: ["CRITICAL", "WARNING", "NOTE"],
          },
          sourceTitle: {
            type: "string",
            description: "Related library resource title when applicable.",
          },
          citedPages: {
            type: "string",
            description:
              "The page reference occurrence cited in the draft (e.g. s. 45).",
          },
        },
        required: ["message", "severity"],
        additionalProperties: false,
      },
    },
    hasCriticalIssues: {
      type: "boolean",
      description:
        "True when at least one CRITICAL citation/page inconsistency was found.",
    },
  },
  required: ["summary", "findings", "hasCriticalIssues"],
  additionalProperties: false,
};

/**
 * Formats a RAG source page reference using Turkish academic APA conventions.
 *
 * @param source - The RAG retrieval result whose page span should be rendered.
 * @returns The page reference string ("Bilinmeyen Sayfa" when no page info exists).
 */
function formatPageReference(source: RagSearchResultItem): string {
  if (source.printedPageNumber) return `${source.printedPageNumber}.`;
  const pageSpan = source.pageStart;
  const range = source.pageEnd;
  if (pageSpan == null) return "Bilinmeyen Sayfa";
  return pageSpan === range ? `s. ${pageSpan}.` : `ss. ${pageSpan}–${range}.`;
}

/**
 * Builds an explicit in-range note for the audit grounding when a source spans
 * multiple published pages, so any cited page inside the span (e.g. s. 126 in
 * ss. 119-151) is recognized as a valid match instead of a "not found" finding.
 *
 * @param source - The RAG retrieval result.
 * @returns The Turkish range note string, or "" when the source is single-page.
 */
function buildRangeNote(source: RagSearchResultItem): string {
  const printed = source.printedPageNumber;
  if (!printed) return "";
  const match = /(\d{1,4})\s*[-–]\s*(\d{1,4})/.exec(printed);
  if (!match) return "";
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (end - start < 1) return "";
  return ` [Kaynak ${match[1]}-${match[2]} aralığındadır; bu aralıktaki her sayfa (ör. s. ${start + 1}) kaynakla EŞLEŞİR ve geçerlidir]`;
}

/**
 * Loads the user's thesis matrix and boxes to enrich the Stage 2 continuation context.
 *
 * @param userId - The ID of the authenticated user.
 * @returns Object containing the matrix and box rendering context.
 */
export async function loadThesisStructureContext(userId: number): Promise<{
  matrixContext: string;
  boxContext: string;
}> {
  const matrix = await db.query.matrices.findFirst({
    where: eq(matrices.userId, userId),
  });
  if (!matrix) {
    return {
      matrixContext: "Henüz tez matrisi oluşturulmamış.",
      boxContext: "Henüz tez kutusu oluşturulmamış.",
    };
  }

  const matrixContext =
    `- Konu ve Problem: ${matrix.subjectProblem}\n` +
    `- Kuramsal Çerçeve: ${matrix.theoreticalFramework}\n` +
    `- Birincil Materyal: ${matrix.primaryMaterial ?? "Belirtilmedi"}\n` +
    `- Yöntem: ${matrix.methodology}`;

  const boxList = await db.query.boxes.findMany({
    where: eq(boxes.matrixId, matrix.id),
  });

  const boxContext =
    boxList.length === 0
      ? "Henüz tez kutusu oluşturulmamış."
      : boxList
          .map(
            (box) =>
              `- [${box.boxType ?? "TANIMSIZ"}] "${box.title}"${
                box.description ? ` — ${box.description}` : ""
              }`,
          )
          .join("\n");

  return { matrixContext, boxContext };
}

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

  const emittedParagraphs = new Set<string>();
  const sourceContext =
    sources.length === 0
      ? "Kütüphanenizde bu taslakla ilgili doğrudan eşleşen kaynak bulunamadı."
      : sources
          .map((source, idx) => {
            const authors = source.resourceAuthors.join(", ");
            const year = source.resourceYear
              ? `Yıl: ${source.resourceYear}`
              : "Yıl bilinmiyor";
            const paragraphText = source.parentContent
              .split(/\n{2,}/)
              .map((paragraph) => paragraph.trim())
              .filter((paragraph) => paragraph.length > 0)
              .filter((paragraph) => {
                if (emittedParagraphs.has(paragraph)) return false;
                emittedParagraphs.add(paragraph);
                return true;
              })
              .join("\n\n");
            return `--- KAYNAK PARÇASI #${idx + 1} ---\n[Eser: "${source.resourceTitle}" | Yazar: ${authors} | ${year} | ${formatPageReference(source)}${buildRangeNote(source)}]\n${paragraphText}`;
          })
          .join("\n\n");

  const annotationContext = await loadAnnotationContext(userId);

  const audit = await generateStructuredContent<AuditReport>(
    FLASH_LITE_35,
    buildPipelineStage1AuditSystemInstruction(sourceContext, annotationContext),
    `Denetlenecek Taslak Metin:\n"""\n${draft}\n"""`,
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

export type { AuditFinding };
