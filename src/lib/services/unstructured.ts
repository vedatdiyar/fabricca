import { createFlowId, Logger } from "@/lib/logger";
import { UnstructuredClient } from "unstructured-client";
import { Strategy } from "unstructured-client/sdk/models/shared";
import { PDFDocument } from "pdf-lib";
import { createConcurrencyLimiter } from "@/lib/rate-limiter";

const CHUNK_PAGES = 50;
const PARALLEL_CONCURRENCY = 10;

export interface UnstructuredChunk {
  chunkIndex: number;
  pageNumber: number | null;
  content: string;
  tokenCount: number;
  elementType?: string;
}

interface UnstructuredRawElement {
  type?: string;
  text?: string;
  metadata?: {
    page_number?: number;
    filename?: string;
    parent_id?: string;
    category_depth?: number;
  };
}

const EXCLUDED_TYPES = new Set(["Header", "Footer", "PageBreak", "PageNumber"]);

/**
 * Extracts a leading printed page number from a Header element.
 * Matches patterns like "121", "120 Mesut Yeğen" → 120.
 * Only used for internal tracking — the value is embedded into chunk content as [Sayfa X].
 */
function extractLeadingNumber(text: string): number | null {
  const match = text.trim().match(/^(\d{1,4})/);
  if (match) {
    const n = parseInt(match[1], 10);
    if (n >= 1 && n <= 9999) return n;
  }
  return null;
}

function buildChunksFromRawElements(
  elements: UnstructuredRawElement[],
): UnstructuredChunk[] {
  const chunks: UnstructuredChunk[] = [];
  let chunkIndex = 0;
  let currentSection = "";
  let buffer: string[] = [];
  let bufferLen = 0;
  let lastPage: number | null = null;
  let currentPrintedPage: number | null = null;
  const MAX_CHARS = 1500;

  function flush() {
    if (buffer.length === 0) return;
    let prefix = currentSection ? `[${currentSection}]` : "";
    const pageSuffix =
      currentPrintedPage !== null ? ` [Sayfa ${currentPrintedPage}]` : "";
    if (prefix || pageSuffix) {
      prefix = prefix + pageSuffix + "\n";
    }
    const text = prefix + buffer.join("\n\n");
    chunks.push({
      chunkIndex: chunkIndex++,
      pageNumber: lastPage,
      content: text,
      tokenCount: Math.ceil(text.length / 4),
    });
    buffer = [];
    bufferLen = 0;
  }

  for (const el of elements) {
    const type = el.type || "";
    const text = (el.text || "").trim();
    if (!text) continue;

    if (EXCLUDED_TYPES.has(type)) {
      if (type === "Header") {
        const pp = extractLeadingNumber(text);
        if (pp !== null) currentPrintedPage = pp;
      }
      continue;
    }

    const page = el.metadata?.page_number ?? null;
    if (page !== null) lastPage = page;

    if (type === "Title") {
      flush();
      currentSection = text.slice(0, 120).replace(/\n/g, " ");
    }

    const shouldChunk =
      type === "Title" ||
      type === "NarrativeText" ||
      type === "ListItem" ||
      type === "CompositeElement" ||
      type === "Table" ||
      type === "UncategorizedText";

    if (!shouldChunk) continue;

    if (bufferLen + text.length > MAX_CHARS && buffer.length > 0) {
      flush();
    }

    buffer.push(text);
    bufferLen += text.length;
  }

  flush();

  return chunks;
}

/**
 * Splits a PDF buffer into smaller buffers, each containing up to CHUNK_PAGES pages.
 * Falls back to the original buffer if pdf-lib cannot parse the PDF.
 *
 * @param buffer - Raw PDF buffer
 * @param pagesPerChunk - Maximum pages per chunk
 * @returns Array of PDF buffers (one per chunk)
 */
async function splitPdfBuffer(
  buffer: Buffer,
  pagesPerChunk: number,
): Promise<Buffer[]> {
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();

  if (totalPages <= pagesPerChunk) {
    return [buffer];
  }

  const chunks: Buffer[] = [];
  for (let start = 0; start < totalPages; start += pagesPerChunk) {
    const end = Math.min(start + pagesPerChunk, totalPages);
    const pageIndices = Array.from(
      { length: end - start },
      (_, i) => start + i,
    );
    const subDoc = await PDFDocument.create();
    const copiedPages = await subDoc.copyPages(pdfDoc, pageIndices);
    for (const page of copiedPages) {
      subDoc.addPage(page);
    }
    const pdfBytes = await subDoc.save();
    chunks.push(Buffer.from(pdfBytes));
  }

  return chunks;
}

/**
 * Extracts UnstructuredRawElement[] from the raw SDK partition response.
 */
function extractElements(response: unknown): UnstructuredRawElement[] {
  if (Array.isArray(response)) return response;
  if (
    typeof response === "object" &&
    response !== null &&
    "elements" in (response as Record<string, unknown>)
  ) {
    const elements = (response as Record<string, unknown>)
      .elements as UnstructuredRawElement[];
    return Array.isArray(elements) ? elements : [];
  }
  return [];
}

/**
 * Partitions a single PDF buffer chunk via the Unstructured SDK.
 * Adjusts element page numbers by the given offset.
 */
async function partitionSingleChunk(
  client: UnstructuredClient,
  buffer: Buffer,
  fileName: string,
  pageOffset: number,
): Promise<UnstructuredRawElement[]> {
  const response = await client.general.partition({
    partitionParameters: {
      files: { content: buffer, fileName },
      strategy: Strategy.HiRes,
    },
  });

  const elements = extractElements(response);

  if (pageOffset > 0) {
    for (const el of elements) {
      if (el.metadata?.page_number != null) {
        el.metadata.page_number += pageOffset;
      }
    }
  }

  return elements;
}

/**
 * Parses and chunks a PDF document using the Unstructured SDK.
 *
 * Splits large PDFs (>50 pages) into page-range chunks and processes them
 * in parallel (up to 10 concurrent requests) to reduce wall-clock time.
 * Applies local chunking with section context.
 * Header, Footer, PageBreak, and PageNumber elements are filtered out;
 * section titles are prepended to each chunk for retrieval context.
 *
 * @param buffer Raw or compressed PDF file buffer
 * @param fileName Name of the PDF file
 * @returns Array of structured document chunks
 */
export async function parsePdfWithUnstructured(
  buffer: Buffer,
  fileName: string,
): Promise<UnstructuredChunk[]> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  const apiKey = process.env.UNSTRUCTURED_API_KEY;
  if (!apiKey) {
    log.error("unstructured_missing_key", {
      service: "library",
      data: {
        message:
          "UNSTRUCTURED_API_KEY is not defined in environment variables.",
      },
    });
    throw new Error(
      "Unstructured API Key bulunamadı. Lütfen UNSTRUCTURED_API_KEY çevre değişkenini kontrol edin.",
    );
  }

  const client = new UnstructuredClient({
    serverURL: "https://api.unstructuredapp.io",
    security: { apiKeyAuth: apiKey },
  });

  // --- Step 1: Split large PDF into page-range chunks ---
  let pdfChunks: Buffer[];
  try {
    pdfChunks = await splitPdfBuffer(buffer, CHUNK_PAGES);
  } catch {
    pdfChunks = [buffer];
  }

  const isMultiChunk = pdfChunks.length > 1;

  log.info("unstructured_sdk_partition_start", {
    service: "library",
    data: {
      fileName,
      bufferSize: buffer.length,
      strategy: "hi_res",
      splitPdfPage: false,
      parallelChunks: isMultiChunk ? pdfChunks.length : 1,
      pagesPerChunk: isMultiChunk ? CHUNK_PAGES : "full",
    },
  });

  // --- Step 2: Process all chunks (parallel if multi-chunk) ---
  let allElements: UnstructuredRawElement[];

  if (isMultiChunk) {
    const limiter = createConcurrencyLimiter(PARALLEL_CONCURRENCY);
    const tasks = pdfChunks.map((chunkBuf, i) =>
      limiter.exec(() =>
        partitionSingleChunk(
          client,
          chunkBuf,
          `chunk_${i}_${fileName}`,
          i * CHUNK_PAGES,
        ),
      ),
    );
    const results = await Promise.all(tasks);
    allElements = results.flat();
  } else {
    const response = await client.general.partition({
      partitionParameters: {
        files: { content: buffer, fileName },
        strategy: Strategy.HiRes,
      },
    });
    allElements = extractElements(response);
  }

  if (!Array.isArray(allElements) || allElements.length === 0) {
    log.error("unstructured_empty_elements", {
      service: "library",
      data: { fileName },
    });
    throw new Error(
      `Unstructured SDK dokümandan hiçbir element çıkaramadı: ${fileName}`,
    );
  }

  log.info("unstructured_sdk_partition_success", {
    service: "library",
    data: { fileName, rawElementCount: allElements.length },
  });

  // --- Step 3: Local chunking ---
  const chunks = buildChunksFromRawElements(allElements);

  if (chunks.length === 0) {
    throw new Error(
      `Elementler filtrelendikten sonra geçerli metin bloğu kalmadı: ${fileName}`,
    );
  }

  log.info("unstructured_local_chunking_success", {
    service: "library",
    data: { fileName, chunkCount: chunks.length },
  });

  return chunks;
}
