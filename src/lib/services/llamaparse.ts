import type { Logger } from "@/lib/logger";

const LLAMAPARSE_JOB_POLL_INTERVAL_MS = 1000;
const LLAMAPARSE_JOB_MAX_WAIT_MS = 3 * 60 * 1000; // 3 min max wait

export interface DocumentChunk {
  chunkIndex: number;
  pdfPageNumber: number | null;
  printedPageNumber: number | null;
  sectionTitle: string | null;
  content: string;
  parentContent?: string;
  tokenCount: number;
}

export type LlamaParseChunk = DocumentChunk;

/**
 * Resolves the LLAMA_CLOUD_API_KEY environment variable.
 */
function getLlamaApiKey(): string {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error(
      "LlamaParse API anahtarı bulunamadı. Lütfen .env.local dosyasında LLAMA_CLOUD_API_KEY tanımlayın.",
    );
  }
  return apiKey;
}

/**
 * Uploads a PDF file to LlamaParse API with best-practice parsing parameters.
 */
async function uploadToLlamaParse(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const apiKey = getLlamaApiKey();
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: "application/pdf" }),
    fileName,
  );
  formData.append("result_type", "markdown");
  formData.append("split_by_page", "true");
  formData.append("page_separator", "\n\n--- Page {page_number} ---\n\n");

  const response = await fetch(
    "https://api.cloud.llamaindex.ai/api/parsing/upload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        accept: "application/json",
      },
      body: formData,
    },
  );

  if (!response.ok) {
    const errorBody = (await response.text()).slice(0, 200);
    throw new Error(
      `LlamaParse dosya yükleme başarısız oldu (HTTP ${response.status}): ${errorBody}`,
    );
  }

  const json = (await response.json()) as { id?: string };
  if (!json.id) {
    throw new Error("LlamaParse yanıtında job ID bulunamadı.");
  }
  return json.id;
}

/**
 * Polls the status of a LlamaParse job until completion.
 */
async function pollLlamaParseJob(jobId: string): Promise<void> {
  const apiKey = getLlamaApiKey();
  const startTime = performance.now();

  while (true) {
    const response = await fetch(
      `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      const errorBody = (await response.text()).slice(0, 200);
      throw new Error(
        `LlamaParse durum sorgulama başarısız (HTTP ${response.status}): ${errorBody}`,
      );
    }

    const json = (await response.json()) as { status?: string };
    const status = json.status;

    if (status === "SUCCESS") {
      return;
    }

    if (status === "ERROR" || status === "CANCELED") {
      throw new Error(
        `LlamaParse ayrıştırma işlemi başarısız oldu (durum: ${status}). JobId: ${jobId}`,
      );
    }

    if (performance.now() - startTime > LLAMAPARSE_JOB_MAX_WAIT_MS) {
      throw new Error(`LlamaParse işlemi zaman aşımına uğradı (${jobId}).`);
    }

    await new Promise((resolve) =>
      setTimeout(resolve, LLAMAPARSE_JOB_POLL_INTERVAL_MS),
    );
  }
}

/**
 * Downloads the resulting Markdown output per page or combined from LlamaParse.
 */
async function fetchLlamaParseResult(
  jobId: string,
): Promise<Array<{ pageNumber: number; text: string }>> {
  const apiKey = getLlamaApiKey();

  // Fetch JSON pages result
  const response = await fetch(
    `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/json`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    // Fallback to raw markdown if json endpoint is unavailable
    const rawResponse = await fetch(
      `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          accept: "application/json",
        },
      },
    );
    if (!rawResponse.ok) {
      throw new Error("LlamaParse sonuç çıktısı indirilemedi.");
    }
    const rawJson = (await rawResponse.json()) as { markdown?: string };
    return [{ pageNumber: 1, text: rawJson.markdown || "" }];
  }

  const json = (await response.json()) as {
    pages?: Array<{ page: number; md?: string; text?: string }>;
  };

  const pages = json.pages || [];
  if (pages.length === 0) {
    return [];
  }

  return pages.map((p) => ({
    pageNumber: p.page || 1,
    text: p.md || p.text || "",
  }));
}

/**
 * Converts Markdown page items into structured RAG chunks with parent-child windowing context.
 */
function buildChunksFromLlamaMarkdown(
  pages: Array<{ pageNumber: number; text: string }>,
): LlamaParseChunk[] {
  const chunks: LlamaParseChunk[] = [];
  let chunkIdx = 0;

  for (const page of pages) {
    const rawText = page.text.trim();
    if (!rawText) continue;

    // Split page text into paragraphs or section headers
    const blocks = rawText.split(/\n{2,}/);
    let currentSection: string | null = null;

    for (const block of blocks) {
      const cleanBlock = block.trim();
      if (!cleanBlock) continue;

      if (cleanBlock.startsWith("#")) {
        currentSection = cleanBlock
          .replace(/^#+\s*/, "")
          .slice(0, 120)
          .replace(/\n/g, " ");
        continue;
      }

      chunks.push({
        chunkIndex: chunkIdx++,
        pdfPageNumber: page.pageNumber,
        printedPageNumber: page.pageNumber,
        sectionTitle: currentSection,
        content: cleanBlock,
        tokenCount: Math.ceil(cleanBlock.length / 4),
      });
    }
  }

  // Apply parent-child window context
  const WINDOW = 3;
  return chunks.map((c, idx) => {
    const start = Math.max(0, idx - 1);
    const end = Math.min(chunks.length, idx + WINDOW);
    const parentText = chunks
      .slice(start, end)
      .map((item) => item.content)
      .join("\n\n");

    return {
      ...c,
      parentContent: parentText,
    };
  });
}

/**
 * High-level service method to parse a PDF file with LlamaParse.
 * Used for OCR (scanned image PDFs) and complex scattered layouts.
 */
export async function parsePdfWithLlamaParse(
  buffer: Buffer,
  fileName: string,
  log: Logger,
): Promise<LlamaParseChunk[]> {
  log.info("pdf_llamaparse_upload_start", {
    service: "library",
    data: { fileName, bufferSize: buffer.length },
  });

  const uploadStart = performance.now();
  let jobId: string;
  try {
    jobId = await uploadToLlamaParse(buffer, fileName);
  } catch (err) {
    log.error("pdf_llamaparse_upload_failed", {
      service: "library",
      error: err,
      data: { fileName },
    });
    throw err;
  }

  log.info("pdf_llamaparse_upload_success", {
    service: "library",
    data: {
      fileName,
      jobId,
      durationMs: Math.round(performance.now() - uploadStart),
    },
  });

  // Poll until terminal status
  const pollStart = performance.now();
  try {
    await pollLlamaParseJob(jobId);
  } catch (err) {
    log.error("pdf_llamaparse_poll_failed", {
      service: "library",
      error: err,
      data: { fileName, jobId },
    });
    throw err;
  }

  log.info("pdf_llamaparse_poll_success", {
    service: "library",
    data: {
      fileName,
      jobId,
      durationMs: Math.round(performance.now() - pollStart),
    },
  });

  // Fetch results
  const resultPages = await fetchLlamaParseResult(jobId);
  const chunks = buildChunksFromLlamaMarkdown(resultPages);

  log.info("pdf_llamaparse_chunking_success", {
    service: "library",
    data: {
      fileName,
      jobId,
      pageCount: resultPages.length,
      chunkCount: chunks.length,
    },
  });

  return chunks;
}
