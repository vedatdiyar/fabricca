import { createFlowId, Logger } from "@/lib/logger";

export interface UnstructuredChunk {
  chunkIndex: number;
  pageNumber: number | null;
  content: string;
  tokenCount: number;
  elementType?: string;
}

interface UnstructuredElement {
  type?: string;
  element_id?: string;
  text?: string;
  metadata?: {
    page_number?: number;
    filename?: string;
    parent_id?: string;
    category_depth?: number;
  };
}

/**
 * Parses and chunks a PDF document using the Unstructured API.
 *
 * Uses `strategy: "hi_res"` and `chunking_strategy: "by_title"` to break down
 * the academic PDF into clean, structured sections while preserving section headings.
 *
 * @param buffer Raw or compressed PDF file buffer
 * @param fileName Name of the PDF file (e.g. Yilmaz_2024_Turk_Edebiyati.pdf)
 * @returns Array of structured document chunks
 * @throws Error if API key is missing or if Unstructured API call fails
 */
export async function parsePdfWithUnstructured(
  buffer: Buffer,
  fileName: string,
): Promise<UnstructuredChunk[]> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  const apiKey = process.env.UNSTRUCTURED_API_KEY;
  const baseUrl =
    process.env.UNSTRUCTURED_API_URL ||
    "https://api.unstructuredapp.io/general/v0/general";

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

  // Construct target endpoint URL for partitioning
  let endpointUrl = baseUrl.trim();
  if (endpointUrl.endsWith("/api/v1") || endpointUrl.endsWith("/api/v1/")) {
    endpointUrl = "https://api.unstructuredapp.io/general/v0/general";
  } else if (
    !endpointUrl.includes("/general/v0/general") &&
    !endpointUrl.includes("/partition")
  ) {
    endpointUrl = `${endpointUrl.replace(/\/$/, "")}/general/v0/general`;
  }

  log.info("unstructured_parse_start", {
    service: "library",
    data: { fileName, bufferSize: buffer.length, endpointUrl },
  });

  const blob = new Blob([new Uint8Array(buffer)], {
    type: "application/pdf",
  });
  const formData = new FormData();
  formData.append("files", blob, fileName);
  formData.append("strategy", "hi_res");
  formData.append("chunking_strategy", "by_title");
  formData.append("max_characters", "1500");
  formData.append("combine_text_under_n_chars", "200");
  formData.append("overlap", "150");

  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: {
      "unstructured-api-key": apiKey,
      accept: "application/json",
    },
    body: formData,
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    log.error("unstructured_api_error_response", {
      service: "library",
      data: { status: response.status, errBody: errBody.slice(0, 500) },
    });
    throw new Error(
      `Unstructured API hatası [HTTP ${response.status}]: ${errBody.slice(0, 300) || response.statusText}`,
    );
  }

  const elements = (await response.json()) as UnstructuredElement[];
  if (!Array.isArray(elements) || elements.length === 0) {
    log.error("unstructured_empty_elements", {
      service: "library",
      data: { fileName },
    });
    throw new Error(
      `Unstructured API dokümandan hiçbir metin parçası çıkaramadı: ${fileName}`,
    );
  }

  const chunks: UnstructuredChunk[] = [];
  let chunkIndex = 0;

  for (const el of elements) {
    const textContent = (el.text || "").trim();
    if (!textContent) continue;

    const pageNumber = el.metadata?.page_number || null;
    const tokenCount = Math.ceil(textContent.length / 4);

    chunks.push({
      chunkIndex: chunkIndex++,
      pageNumber,
      content: textContent,
      tokenCount,
      elementType: el.type,
    });
  }

  if (chunks.length === 0) {
    throw new Error(
      `Unstructured API ayrıştırma sonrası geçerli metin bloğu bulunamadı: ${fileName}`,
    );
  }

  log.info("unstructured_parse_success", {
    service: "library",
    data: { fileName, chunkCount: chunks.length },
  });

  return chunks;
}
