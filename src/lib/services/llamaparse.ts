import { MarkdownTextSplitter } from "@langchain/textsplitters";
import type { Logger } from "@/lib/logger";
import { withRetry, HttpError, DEFAULT_MAX_DELAY } from "@/lib/api-utils";
import { isNoiseChunk } from "./pdf/chunker";

const LLAMAPARSE_JOB_POLL_INTERVAL_MS = 1000;
const LLAMAPARSE_JOB_MAX_WAIT_MS = 3 * 60 * 1000;

/** Max total attempts per HTTP request (1 initial + 2 retries) for transient failures. */
const LLAMAPARSE_MAX_RETRIES = 3;
/** Base exponential backoff delay for LlamaParse retries (Full Jitter applied by withRetry). */
const LLAMAPARSE_RETRY_BASE_DELAY_MS = 500;

const markdownSplitter = new MarkdownTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

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
 * Returns the LlamaParse API key from the environment, throwing when it is missing.
 *
 * @returns The LLAMA_CLOUD_API_KEY value.
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
 * Parses the `Retry-After` header into milliseconds, or null when absent or in HTTP-date format.
 *
 * @param response - The HTTP response whose Retry-After header is read.
 * @returns The retry delay in milliseconds, or null when the header is absent or unusable.
 */
function parseRetryAfterHeader(response: Response): number | null {
  const header = response.headers.get("Retry-After");
  if (!header) return null;

  const seconds = parseInt(header, 10);
  if (!isNaN(seconds) && seconds > 0) {
    return seconds * 1000;
  }

  return null;
}

/**
 * Performs a LlamaParse HTTP request with exponential backoff retry on transient failures only.
 *
 * @param url - The LlamaParse endpoint URL to request.
 * @param init - The fetch request options.
 * @param log - Optional logger for retry events.
 * @param logPrefix - Prefix used for retry event labels.
 * @returns The fetch Response when the request succeeds.
 */
function llamaFetchWithRetry(
  url: string,
  init: RequestInit,
  log: Logger | undefined,
  logPrefix: string,
): Promise<Response> {
  return withRetry(
    async () => {
      const response = await fetch(url, init);
      if (!response.ok) {
        const errorBody = (await response.text()).slice(0, 200);
        throw new HttpError(
          response.status,
          errorBody,
          parseRetryAfterHeader(response),
        );
      }
      return response;
    },
    {
      maxRetries: LLAMAPARSE_MAX_RETRIES,
      baseDelay: LLAMAPARSE_RETRY_BASE_DELAY_MS,
      maxDelay: DEFAULT_MAX_DELAY,
      isRetryable: (error) => {
        if (error instanceof HttpError) {
          return error.status === 429 || error.status >= 500;
        }
        return true;
      },
      getRetryAfter: (error) =>
        error instanceof HttpError ? error.retryAfter : null,
      onRetry: (attempt, delayMs, error) => {
        const httpStatus =
          error instanceof HttpError ? error.status : undefined;
        const retryAfter =
          error instanceof HttpError ? error.retryAfter : undefined;
        log?.info(`${logPrefix}_retry`, {
          service: "library",
          data: {
            attempt,
            maxRetries: LLAMAPARSE_MAX_RETRIES,
            delayMs: Math.round(delayMs),
            httpStatus,
            retryAfter,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          },
        });
      },
    },
  );
}

/**
 * Uploads a PDF buffer to LlamaParse and returns the created job ID.
 *
 * @param buffer - The PDF file contents to upload.
 * @param fileName - The original PDF file name.
 * @param tier - The LlamaParse parsing tier to use.
 * @param log - Optional logger for upload events.
 * @param logPrefix - Prefix used for retry event labels.
 * @returns The LlamaParse job ID for the uploaded document.
 */
async function uploadToLlamaParse(
  buffer: Buffer,
  fileName: string,
  tier: "fast" | "cost_effective" | "agentic",
  log: Logger | undefined,
  logPrefix: string,
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
  formData.append("tier", tier);
  formData.append("version", "latest");
  formData.append("language", "tr");
  formData.append("language", "en");
  formData.append(
    "parsing_instruction",
    "Bu belge akademik bir makale veya kitaptır. Ayrıştırma yaparken aşağıdaki genel akademik kurallara uyunuz:\n" +
      "1. DÜZEN VE SÜTUN HİYERARŞİSİ: Belge çok sütunlu (multi-column) olsa dahi metin akışını soldan sağa ve yukarıdan aşağıya doğru anlamsal bütünlük içinde birleştirin. Sütunları birbirine karıştırmayın.\n" +
      "2. KATEGORİ VE TASARIM ETİKETLERİ: Sayfa üst ve alt bilgilerini (header/footer), sayfa numaralarını ve 'DOSYA', 'MAKALELER', 'ARAŞTIRMA', 'ÇEVİRİ', 'EDİTÖRDEN', 'GİRİŞ', 'KİTAP ELEŞTİRİSİ' gibi dergi/bölüm kategorilerini yazar ismi veya başlık parçası sanıp ana metne karıştırmayın.\n" +
      "3. YAZAR VE BAŞLIK BÜTÜNLÜĞÜ: Makalenin ana başlığını ve yazar adlarını ilk sayfada en üstte tam ve eksiksiz tutun.\n" +
      "4. DİPNOTLAR (FOOTNOTES): Sayfa altındaki dipnotları, atıfları ve dipnot numaralarını ana metin başlığından ve ana makale gövdesinden ayrı tutun, sayfa sonuna 'Footnotes:' başlığı altında yerleştirin.\n" +
      "5. TABLOLAR VE FORMÜLLER: Tabloları temiz Markdown tablo formatında (| col1 | col2 |) çıkarın.\n" +
      "6. TÜRKÇE KARAKTERLER: Metni orijinal dilinde tutun ve Türkçe karakterleri (Ş, İ, Ğ, Ç, Ü, Ö, ı) eksiksiz koruyun, diyakritik harfleri düşürmeyin.",
  );

  const response = await llamaFetchWithRetry(
    "https://api.cloud.llamaindex.ai/api/parsing/upload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        accept: "application/json",
      },
      body: formData,
    },
    log,
    logPrefix,
  );

  const json = (await response.json()) as { id?: string };
  if (!json.id) {
    throw new Error("LlamaParse yanıtında job ID bulunamadı.");
  }
  return json.id;
}

/**
 * Polls a LlamaParse job until it succeeds, fails, or times out.
 *
 * @param jobId - The LlamaParse job ID to poll.
 * @param log - Optional logger for poll events.
 * @param logPrefix - Prefix used for retry event labels.
 */
async function pollLlamaParseJob(
  jobId: string,
  log: Logger | undefined,
  logPrefix: string,
): Promise<void> {
  const apiKey = getLlamaApiKey();
  const startTime = performance.now();

  while (true) {
    const response = await llamaFetchWithRetry(
      `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          accept: "application/json",
        },
      },
      log,
      logPrefix,
    );

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
 * Downloads the parsed page results for a completed LlamaParse job.
 *
 * @param jobId - The LlamaParse job ID whose result is fetched.
 * @param log - Optional logger for result events.
 * @param logPrefix - Prefix used for retry event labels.
 * @returns The parsed pages as page number and markdown text pairs.
 */
async function fetchLlamaParseResult(
  jobId: string,
  log: Logger | undefined,
  logPrefix: string,
): Promise<Array<{ pageNumber: number; text: string }>> {
  const apiKey = getLlamaApiKey();

  const response = await llamaFetchWithRetry(
    `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/json`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        accept: "application/json",
      },
    },
    log,
    logPrefix,
  );

  if (!response.ok) {
    const rawResponse = await llamaFetchWithRetry(
      `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          accept: "application/json",
        },
      },
      log,
      logPrefix,
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
 * Splits parsed page markdown into RAG chunks with section titles and parent context.
 *
 * @param pages - The parsed pages as page number and markdown text pairs.
 * @returns The list of RAG chunks ready for embedding.
 */
async function buildChunksFromLlamaMarkdown(
  pages: Array<{ pageNumber: number; text: string }>,
): Promise<LlamaParseChunk[]> {
  const rawChunks: LlamaParseChunk[] = [];
  let chunkIdx = 0;

  for (const page of pages) {
    const rawText = page.text.trim();
    if (!rawText) continue;

    const subBlocks = await markdownSplitter.splitText(rawText);
    let currentSectionTitle: string | null = null;

    for (const block of subBlocks) {
      const cleanBlock = block.trim();
      if (!cleanBlock || isNoiseChunk(cleanBlock)) continue;

      const headerMatch = cleanBlock.match(/^#+\s+(.+)$/m);
      if (headerMatch) {
        currentSectionTitle = headerMatch[1].slice(0, 120).trim();
      }

      rawChunks.push({
        chunkIndex: chunkIdx++,
        pdfPageNumber: page.pageNumber,
        printedPageNumber: page.pageNumber,
        sectionTitle: currentSectionTitle,
        content: cleanBlock,
        tokenCount: Math.ceil(cleanBlock.length / 4),
      });
    }
  }

  const WINDOW = 3;
  return rawChunks.map((c, idx) => {
    const start = Math.max(0, idx - 1);
    const end = Math.min(rawChunks.length, idx + WINDOW);
    const parentText = rawChunks
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
 * Parses a PDF with LlamaParse for OCR (scanned images) and complex layouts, returning RAG chunks.
 *
 * @param buffer - The PDF file contents to parse.
 * @param fileName - The original PDF file name.
 * @param log - Logger used for pipeline progress events.
 * @param tier - The LlamaParse parsing tier to use.
 * @returns The list of RAG chunks extracted from the PDF.
 */
export async function parsePdfWithLlamaParse(
  buffer: Buffer,
  fileName: string,
  log: Logger,
  tier: "fast" | "cost_effective" | "agentic" = "cost_effective",
): Promise<LlamaParseChunk[]> {
  log.info("pdf_llamaparse_upload_start", {
    service: "library",
    data: { fileName, bufferSize: buffer.length, tier },
  });

  let jobId: string;
  try {
    jobId = await uploadToLlamaParse(
      buffer,
      fileName,
      tier,
      log,
      "pdf_llamaparse_upload",
    );
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
    data: { fileName, jobId },
  });

  log.info("pdf_llamaparse_poll_start", {
    service: "library",
    data: { fileName, jobId },
  });
  try {
    await pollLlamaParseJob(jobId, log, "pdf_llamaparse_poll");
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
    data: { fileName, jobId },
  });

  log.info("pdf_llamaparse_chunking_start", {
    service: "library",
    data: { fileName, jobId },
  });
  const resultPages = await fetchLlamaParseResult(
    jobId,
    log,
    "pdf_llamaparse_result",
  );
  const chunks = await buildChunksFromLlamaMarkdown(resultPages);

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
