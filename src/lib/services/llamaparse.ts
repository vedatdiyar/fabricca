import { MarkdownTextSplitter } from "@langchain/textsplitters";
import type { Logger } from "@/lib/logger";
import { isNoiseChunk } from "./pdf/chunker";

const LLAMAPARSE_JOB_POLL_INTERVAL_MS = 1000;
const LLAMAPARSE_JOB_MAX_WAIT_MS = 3 * 60 * 1000; // 3 min max wait

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
  tier: "fast" | "cost_effective" | "agentic" = "cost_effective",
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
 * Uses LangChain's MarkdownTextSplitter with noise filtering and table preservation.
 */
async function buildChunksFromLlamaMarkdown(
  pages: Array<{ pageNumber: number; text: string }>,
): Promise<LlamaParseChunk[]> {
  const rawChunks: LlamaParseChunk[] = [];
  let chunkIdx = 0;

  for (const page of pages) {
    const rawText = page.text.trim();
    if (!rawText) continue;

    // Split page markdown using LangChain's MarkdownTextSplitter
    const subBlocks = await markdownSplitter.splitText(rawText);
    let currentSectionTitle: string | null = null;

    for (const block of subBlocks) {
      const cleanBlock = block.trim();
      if (!cleanBlock || isNoiseChunk(cleanBlock)) continue;

      // Detect header line if block starts with #
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

  // Apply parent-child window context
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
 * High-level service method to parse a PDF file with LlamaParse.
 * Used for OCR (scanned image PDFs) and complex scattered layouts.
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
    jobId = await uploadToLlamaParse(buffer, fileName, tier);
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

  // Poll until terminal status
  log.info("pdf_llamaparse_poll_start", {
    service: "library",
    data: { fileName, jobId },
  });
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
    data: { fileName, jobId },
  });

  // Fetch results
  log.info("pdf_llamaparse_chunking_start", {
    service: "library",
    data: { fileName, jobId },
  });
  const resultPages = await fetchLlamaParseResult(jobId);
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
