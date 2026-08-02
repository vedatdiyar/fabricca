import type { Logger } from "@/lib/logger";
import { parsePdfWithUnstructured } from "./unstructured";
import type { UnstructuredParseResult } from "./unstructured";

export type PdfParseResult = UnstructuredParseResult;

/**
 * Parses a PDF document into RAG-ready chunks and raw references using Unstructured VLM Serverless API.
 *
 * @param buffer - The raw PDF file content as a byte buffer.
 * @param fileName - The original file name of the PDF.
 * @param log - Logger instance for structured pipeline logging.
 * @returns The extracted RAG-ready document chunks and optional raw references text.
 */
export async function parsePdfDocument(
  buffer: Buffer,
  fileName: string,
  log: Logger,
): Promise<PdfParseResult> {
  const pipelineStart = performance.now();

  log.info("pdf_parser_unstructured_start", {
    service: "pdf-parser",
    data: { fileName, bufferSize: buffer.length, partitioner: "auto" },
  });

  const result = await parsePdfWithUnstructured(buffer, fileName, log);

  if (result.chunks.length === 0) {
    throw new Error(`PDF parser hiç chunk üretemedi. Dosya: ${fileName}`);
  }

  const totalDurationMs = Math.round(performance.now() - pipelineStart);

  log.info("pdf_parser_pipeline_success", {
    service: "pdf-parser",
    data: {
      fileName,
      chunkCount: result.chunks.length,
      hasReferences: result.rawReferences !== null,
      totalTokens: result.chunks.reduce((s, c) => s + c.tokenCount, 0),
      totalDurationMs,
    },
  });

  return result;
}
