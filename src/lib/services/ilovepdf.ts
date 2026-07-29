import { createFlowId, Logger } from "@/lib/logger";

/** Default size threshold (2 MB) above which PDF compression is triggered */
export const DEFAULT_PDF_COMPRESS_THRESHOLD_BYTES = 2 * 1024 * 1024;

interface ILovePdfAuthResponse {
  token?: string;
  error?: string;
  message?: string;
}

interface ILovePdfStartResponse {
  server?: string;
  task?: string;
  error?: string;
  message?: string;
}

interface ILovePdfUploadResponse {
  server_filename?: string;
  error?: string;
  message?: string;
}

interface ILovePdfProcessResponse {
  status?: string;
  download_filename?: string;
  filesize?: number;
  output_filesize?: number;
  timer?: string;
  error?: string;
  message?: string;
}

interface CompressPdfResult {
  /** The optimized or original PDF buffer */
  buffer: Buffer;
  /** Whether compression was successfully executed and produced a smaller file */
  isCompressed: boolean;
  /** Original file size in bytes */
  originalSize: number;
  /** Final file size in bytes */
  compressedSize: number;
}

/**
 * Compresses a PDF file buffer using the iLovePDF REST API.
 *
 * If the compression succeeds and results in a smaller file size, the compressed
 * buffer is returned. If an error occurs or the compressed file is larger than the original,
 * it gracefully falls back to returning the original buffer.
 *
 * @param buffer Raw PDF file buffer
 * @param fileName Name of the PDF file (e.g. Yilmaz_2024_Turk_Edebiyati.pdf)
 * @returns Result object containing the (compressed or original) buffer and file size metadata
 */
export async function compressPdfWithILovePdf(
  buffer: Buffer,
  fileName: string,
): Promise<CompressPdfResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const originalSize = buffer.length;

  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY;
  if (!publicKey) {
    log.warn("ilovepdf_missing_key", {
      service: "ilovepdf",
      data: {
        message: "ILOVEPDF_PUBLIC_KEY is not defined in environment variables.",
      },
    });
    return {
      buffer,
      isCompressed: false,
      originalSize,
      compressedSize: originalSize,
    };
  }

  try {
    // Step 1: Authentication
    log.info("ilovepdf_auth_start", {
      service: "ilovepdf",
      data: { fileName, originalSize },
    });
    const authRes = await fetch("https://api.ilovepdf.com/v1/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_key: publicKey }),
    });

    if (!authRes.ok) {
      throw new Error(`Auth request failed with status ${authRes.status}`);
    }

    const authData = (await authRes.json()) as ILovePdfAuthResponse;
    if (!authData.token) {
      throw new Error(
        authData.error || authData.message || "Failed to retrieve auth token",
      );
    }
    const token = authData.token;

    // Step 2: Start Compress Task
    log.info("ilovepdf_start_task", { service: "ilovepdf" });
    const startRes = await fetch("https://api.ilovepdf.com/v1/start/compress", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!startRes.ok) {
      throw new Error(`Start task failed with status ${startRes.status}`);
    }

    const startData = (await startRes.json()) as ILovePdfStartResponse;
    if (!startData.server || !startData.task) {
      throw new Error(
        startData.error || startData.message || "Invalid start task response",
      );
    }
    const { server, task } = startData;

    // Step 3: Upload File
    log.info("ilovepdf_upload_file", {
      service: "ilovepdf",
      data: { server, task },
    });
    const blob = new Blob([new Uint8Array(buffer)], {
      type: "application/pdf",
    });
    const formData = new FormData();
    formData.append("task", task);
    formData.append("file", blob, fileName);

    const uploadRes = await fetch(`https://${server}/v1/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!uploadRes.ok) {
      throw new Error(`Upload request failed with status ${uploadRes.status}`);
    }

    const uploadData = (await uploadRes.json()) as ILovePdfUploadResponse;
    if (!uploadData.server_filename) {
      throw new Error(
        uploadData.error || uploadData.message || "Invalid upload response",
      );
    }

    // Step 4: Process Compression
    log.info("ilovepdf_process_compress", {
      service: "ilovepdf",
      data: { task },
    });
    const processRes = await fetch(`https://${server}/v1/process`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task,
        tool: "compress",
        files: [
          {
            server_filename: uploadData.server_filename,
            filename: fileName,
          },
        ],
        compression_level: "recommended",
      }),
    });

    if (!processRes.ok) {
      throw new Error(
        `Process request failed with status ${processRes.status}`,
      );
    }

    const processData = (await processRes.json()) as ILovePdfProcessResponse;
    if (processData.status !== "TaskSuccess") {
      throw new Error(
        processData.error ||
          processData.message ||
          "Process task returned non-success status",
      );
    }

    // Step 5: Download Compressed File
    log.info("ilovepdf_download_file", { service: "ilovepdf", data: { task } });
    const downloadRes = await fetch(`https://${server}/v1/download/${task}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!downloadRes.ok) {
      throw new Error(
        `Download request failed with status ${downloadRes.status}`,
      );
    }

    const compressedArrayBuffer = await downloadRes.arrayBuffer();
    const compressedBuffer = Buffer.from(compressedArrayBuffer);
    const compressedSize = compressedBuffer.length;

    // Check if compressed size is actually smaller than original
    if (compressedSize > 0 && compressedSize < originalSize) {
      const savedBytes = originalSize - compressedSize;
      const savedPercentage = ((savedBytes / originalSize) * 100).toFixed(1);

      log.info("ilovepdf_compress_success", {
        service: "ilovepdf",
        data: {
          fileName,
          originalSize,
          compressedSize,
          savedBytes,
          savedPercentage: `${savedPercentage}%`,
        },
      });

      return {
        buffer: compressedBuffer,
        isCompressed: true,
        originalSize,
        compressedSize,
      };
    }

    log.warn("ilovepdf_compress_larger_or_equal", {
      service: "ilovepdf",
      data: { fileName, originalSize, compressedSize },
    });

    return {
      buffer,
      isCompressed: false,
      originalSize,
      compressedSize: originalSize,
    };
  } catch (err) {
    log.error("ilovepdf_compress_fallback", {
      service: "ilovepdf",
      error: err,
      data: { fileName, originalSize },
    });

    // Gracefully fallback to original buffer on error
    return {
      buffer,
      isCompressed: false,
      originalSize,
      compressedSize: originalSize,
    };
  }
}
