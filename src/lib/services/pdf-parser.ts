import pdf2md from "@opendocsg/pdf2md";
import type { Logger } from "@/lib/logger";
import { parsePdfWithLlamaParse } from "./llamaparse";
import type { DocumentChunk } from "./llamaparse";
import { classifyDocumentStrategy } from "./pdf/page-classifier";
import { normalizeMarkdownStyle } from "./pdf/markdown-normalizer";
import { normalizeTurkishText } from "./pdf/turkish-normalizer";
import { buildLocalChunksFromMarkdown } from "./pdf/chunker";

export type { DocumentChunk };

/**
 * Parses a PDF document into RAG-ready chunks using a document-level strategy router (PDF2MD or LlamaParse).
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

  log.info("pdf_router_classify_start", {
    service: "pdf-parser",
    data: { fileName, bufferSize: buffer.length },
  });

  const classification = await classifyDocumentStrategy(buffer);

  log.info("pdf_router_strategy_selected", {
    service: "pdf-parser",
    data: {
      fileName,
      strategy: classification.strategy,
      pageCount: classification.pageCount,
      sampledPages: classification.sampledPages,
      reason: classification.reason,
      scanDurationMs: classification.scanDurationMs,
    },
  });

  let chunks: DocumentChunk[] = [];

  if (classification.strategy === "PDF2MD") {
    log.info("pdf_router_pdf2md_start", {
      service: "pdf-parser",
      data: { fileName },
    });

    const pdf2mdStart = performance.now();
    let rawMd = "";

    try {
      rawMd = await pdf2md(new Uint8Array(buffer));
    } catch (err) {
      log.error("pdf_router_pdf2md_failed", {
        service: "pdf-parser",
        error: err,
        data: { fileName },
      });
    }

    if (rawMd && rawMd.trim().length >= 100) {
      const normalized = normalizeMarkdownStyle(rawMd);
      const finalMarkdown = normalizeTurkishText(normalized.markdown);

      chunks = await buildLocalChunksFromMarkdown(finalMarkdown);

      log.info("pdf_router_pdf2md_success", {
        service: "pdf-parser",
        data: {
          fileName,
          rawLength: rawMd.length,
          chunkCount: chunks.length,
          durationMs: Math.round(performance.now() - pdf2mdStart),
        },
      });
    } else {
      log.info("pdf_router_pdf2md_fallback_to_llamaparse", {
        service: "pdf-parser",
        data: {
          fileName,
          rawLength: rawMd.length,
          reason:
            "PDF2MD metin çıktısı yetersiz, LlamaParse servisine yönlendiriliyor.",
        },
      });
      chunks = await parsePdfWithLlamaParse(
        buffer,
        fileName,
        log,
        "cost_effective",
      );
    }
  } else {
    log.info("pdf_router_llamaparse_start", {
      service: "pdf-parser",
      data: { fileName, reason: classification.reason },
    });

    chunks = await parsePdfWithLlamaParse(
      buffer,
      fileName,
      log,
      "cost_effective",
    );
  }

  if (chunks.length === 0) {
    throw new Error(
      `PDF parser hiç chunk üretemedi. Dosya: ${fileName} (${classification.pageCount} sayfa, strateji: ${classification.strategy})`,
    );
  }

  const totalDurationMs = Math.round(performance.now() - pipelineStart);

  log.info("pdf_router_pipeline_success", {
    service: "pdf-parser",
    data: {
      fileName,
      strategy: classification.strategy,
      pageCount: classification.pageCount,
      chunkCount: chunks.length,
      totalTokens: chunks.reduce((s, c) => s + c.tokenCount, 0),
      totalDurationMs,
    },
  });

  return chunks;
}
