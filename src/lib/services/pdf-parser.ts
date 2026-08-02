import type { Logger } from "@/lib/logger";
import type { DocumentChunk } from "./llamaparse";
import { classifyAllPages } from "./pdf/page-classifier";
import { buildBatches } from "./pdf/batch-builder";
import { executeBatches } from "./pdf/batch-executor";
import { stitchPageMarkdowns } from "./pdf/markdown-stitcher";
import { normalizeMarkdownStyle } from "./pdf/markdown-normalizer";
import { normalizeTurkishText } from "./pdf/turkish-normalizer";
import { buildLocalChunksFromMarkdown } from "./pdf/chunker";

export type { DocumentChunk };

/**
 * Parses a PDF into RAG-ready chunks through a 4-step hybrid engine: classify, batch, stitch, and normalize.
 *
 * @param buffer - The raw PDF file content as a byte buffer.
 * @param fileName - The original file name of the PDF.
 * @param log - Logger instance for structured pipeline logging.
 * @returns The extracted RAG-ready document chunks.
 */
export async function parsePdfWithHybridRouter(
  buffer: Buffer,
  fileName: string,
  log: Logger,
): Promise<DocumentChunk[]> {
  const pipelineStart = performance.now();

  log.info("pdf_hybrid_step1_classify_start", {
    service: "pdf-parser",
    data: { fileName, bufferSize: buffer.length },
  });

  const step1Start = performance.now();
  let fullScan: Awaited<ReturnType<typeof classifyAllPages>>;

  try {
    fullScan = await classifyAllPages(buffer);
  } catch (err) {
    log.error("pdf_hybrid_step1_classify_failed", {
      service: "pdf-parser",
      error: err,
      data: { fileName },
    });
    throw err;
  }

  log.info("pdf_hybrid_step1_classify_success", {
    service: "pdf-parser",
    data: {
      fileName,
      pageCount: fullScan.pageCount,
      classA: fullScan.labelSummary.classA,
      classB: fullScan.labelSummary.classB,
      classC: fullScan.labelSummary.classC,
      scanDurationMs: fullScan.scanDurationMs,
      step1DurationMs: Math.round(performance.now() - step1Start),
    },
  });

  const batches = buildBatches(fullScan.classifications);

  log.info("pdf_hybrid_step2_batches_built", {
    service: "pdf-parser",
    data: {
      fileName,
      batchCount: batches.length,
      batchSummary: batches.map((b) => ({
        label: b.label,
        pages: `${b.startPage}-${b.endPage}`,
        count: b.pageCount,
        tier: b.llamaParseTier,
      })),
    },
  });

  log.info("pdf_hybrid_step2_execute_start", {
    service: "pdf-parser",
    data: { fileName, batchCount: batches.length },
  });

  const step2Start = performance.now();
  let batchResult: Awaited<ReturnType<typeof executeBatches>>;

  try {
    batchResult = await executeBatches(
      batches,
      buffer,
      fileName,
      fullScan.pageCount,
      log,
    );
  } catch (err) {
    log.error("pdf_hybrid_step2_execute_failed", {
      service: "pdf-parser",
      error: err,
      data: { fileName },
    });
    throw err;
  }

  log.info("pdf_hybrid_step2_execute_success", {
    service: "pdf-parser",
    data: {
      fileName,
      outputPageCount: batchResult.pages.length,
      ...batchResult.batchStats,
      step2DurationMs: Math.round(performance.now() - step2Start),
    },
  });

  log.info("pdf_hybrid_step3_stitch_start", {
    service: "pdf-parser",
    data: { fileName, pageCount: batchResult.pages.length },
  });

  const step3Start = performance.now();
  const stitched = stitchPageMarkdowns(batchResult.pages);

  log.info("pdf_hybrid_step3_stitch_success", {
    service: "pdf-parser",
    data: {
      fileName,
      ...stitched.repairsApplied,
      outputLength: stitched.fullMarkdown.length,
      step3DurationMs: Math.round(performance.now() - step3Start),
    },
  });

  log.info("pdf_hybrid_step4_normalize_start", {
    service: "pdf-parser",
    data: { fileName },
  });

  const step4Start = performance.now();
  const normalized = normalizeMarkdownStyle(stitched.fullMarkdown);
  const finalMarkdown = normalizeTurkishText(normalized.markdown);

  log.info("pdf_hybrid_step4_normalize_success", {
    service: "pdf-parser",
    data: {
      fileName,
      ...normalized.normalizationsApplied,
      step4DurationMs: Math.round(performance.now() - step4Start),
    },
  });

  log.info("pdf_hybrid_chunking_start", {
    service: "pdf-parser",
    data: { fileName, markdownLength: finalMarkdown.length },
  });

  const chunkStart = performance.now();
  let chunks: DocumentChunk[];

  try {
    chunks = await buildLocalChunksFromMarkdown(finalMarkdown);
  } catch (err) {
    log.error("pdf_hybrid_chunking_failed", {
      service: "pdf-parser",
      error: err,
      data: { fileName },
    });
    throw err;
  }

  if (chunks.length === 0) {
    throw new Error(
      `Hibrit PDF parser hiç chunk üretemedi. Dosya: ${fileName} (${fullScan.pageCount} sayfa, ${fullScan.labelSummary.classA}A+${fullScan.labelSummary.classB}B+${fullScan.labelSummary.classC}C)`,
    );
  }

  const totalDurationMs = Math.round(performance.now() - pipelineStart);

  log.info("pdf_hybrid_pipeline_success", {
    service: "pdf-parser",
    data: {
      fileName,
      pageCount: fullScan.pageCount,
      classA: fullScan.labelSummary.classA,
      classB: fullScan.labelSummary.classB,
      classC: fullScan.labelSummary.classC,
      chunkCount: chunks.length,
      totalTokens: chunks.reduce((s, c) => s + c.tokenCount, 0),
      chunkDurationMs: Math.round(performance.now() - chunkStart),
      totalDurationMs,
    },
  });

  return chunks;
}
