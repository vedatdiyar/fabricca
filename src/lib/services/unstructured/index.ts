import type { Logger } from "@/lib/logger";
import {
  buildChunksFromPageMarkdown,
  extractReferencesFromMarkdown,
  type DocumentChunk,
} from "@/lib/services/pdf/chunker";
import {
  createUnstructuredJob,
  pollUnstructuredJob,
  downloadUnstructuredJobOutput,
  cancelUnstructuredJob,
  type UnstructuredElement,
} from "./client";
import { partitionAutoNode, buildRequestData } from "./job-nodes";
import { elementsToPageMarkdown } from "./elements";

export type { UnstructuredElement } from "./client";

export interface UnstructuredParseResult {
  chunks: DocumentChunk[];
  rawReferences: string | null;
}

/**
 * Parses a PDF document via the Unstructured Transform API (partition-only) into RAG chunks and raw references.
 *
 * @param buffer - The raw PDF file content as a byte buffer.
 * @param fileName - The original file name of the PDF.
 * @param log - Logger instance for structured pipeline logging.
 * @returns Result containing RAG chunks and raw references text.
 */
export async function parsePdfWithUnstructured(
  buffer: Buffer,
  fileName: string,
  log: Logger,
): Promise<UnstructuredParseResult> {
  const pipelineStart = performance.now();

  log.info("pdf_unstructured_job_start", {
    service: "pdf-parser",
    data: { fileName, bufferSize: buffer.length, partitioner: "auto" },
  });

  const requestData = buildRequestData([
    partitionAutoNode(
      process.env.UNSTRUCTURED_VLM_PROVIDER ?? "vertexai",
      process.env.UNSTRUCTURED_VLM_MODEL ?? "gemini-2.5-flash",
    ),
  ]);
  const jobId = await createUnstructuredJob(buffer, fileName, requestData, log);

  log.info("pdf_unstructured_job_success", {
    service: "pdf-parser",
    data: { fileName, jobId },
  });

  let completed;
  try {
    completed = await pollUnstructuredJob(jobId, log);
  } catch (error) {
    await cancelUnstructuredJob(jobId);
    throw error;
  }

  log.info("pdf_unstructured_download_start", {
    service: "pdf-parser",
    data: { fileName, jobId },
  });

  const outputFiles = completed.output_node_files ?? [];
  const elements: UnstructuredElement[] = [];

  for (const output of outputFiles) {
    if (!output.file_id) continue;
    const raw = await downloadUnstructuredJobOutput(jobId, output.file_id);
    if (Array.isArray(raw)) {
      elements.push(...(raw as UnstructuredElement[]));
    }
  }

  if (elements.length === 0) {
    throw new Error(
      `Unstructured hiç element üretemedi. Dosya: ${fileName} JobId: ${jobId}`,
    );
  }

  const pageMarkdown = elementsToPageMarkdown(elements);

  // Mark page boundaries explicitly in full text for exact document-wide reference truncation
  const pagesWithMarkers = pageMarkdown
    .map((page) => `--- PAGE_MARKER_${page.pageNumber} ---\n${page.text}`)
    .join("\n\n");

  const { mainBody, rawReferences } =
    extractReferencesFromMarkdown(pagesWithMarkers);

  // Reconstruct filtered main body pages
  const filteredPages: Array<{ pageNumber: number; text: string }> = [];
  const pageBlocks = mainBody.split(/--- PAGE_MARKER_(\d+) ---\n?/);

  for (let i = 1; i < pageBlocks.length; i += 2) {
    const pageNumber = parseInt(pageBlocks[i], 10);
    const text = (pageBlocks[i + 1] || "").trim();
    if (text) {
      filteredPages.push({ pageNumber, text });
    }
  }

  const chunks = await buildChunksFromPageMarkdown(
    filteredPages.length > 0 ? filteredPages : pageMarkdown,
  );

  const totalDurationMs = Math.round(performance.now() - pipelineStart);

  log.info("pdf_unstructured_pipeline_success", {
    service: "pdf-parser",
    data: {
      fileName,
      jobId,
      elementCount: elements.length,
      pageCount: pageMarkdown.length,
      chunkCount: chunks.length,
      hasReferences: rawReferences !== null,
      totalTokens: chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
      totalDurationMs,
    },
  });

  return { chunks, rawReferences };
}
