import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { createFlowId, Logger } from "@/lib/logger";

/**
 * Singleton Cloudflare R2 S3 Client instance.
 */
function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Cloudflare R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) are missing in environment variables.",
    );
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Uploads a PDF file buffer directly to Cloudflare R2 Bucket.
 *
 * @param buffer Raw PDF file buffer
 * @param resourceId ID of the linked library resource
 * @param apaFileName APA-styled standardized filename (e.g. Yilmaz_2024_Turk_Edebiyati.pdf)
 * @returns Object containing public URL and R2 Key
 */
export async function uploadPdfToR2(
  buffer: Buffer,
  resourceId: number,
  apaFileName: string,
): Promise<{ r2Url: string; r2Key: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  const bucketName = process.env.R2_BUCKET_NAME || "fabricca";
  const publicDomain =
    process.env.R2_PUBLIC_DOMAIN ||
    "https://pub-ad6349c3ea934f3a9a8f6232ae5bf475.r2.dev";

  const r2Key = `pdfs/${apaFileName}`;

  try {
    const s3Client = getR2Client();

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: r2Key,
        Body: buffer,
        ContentType: "application/pdf",
      }),
    );

    const r2Url = `${publicDomain.replace(/\/$/, "")}/${r2Key}`;

    log.info("r2_upload_success", {
      service: "cloudflare",
      data: { resourceId, r2Key, r2Url, size: buffer.length },
    });

    return { r2Url, r2Key };
  } catch (err) {
    log.error("r2_upload_failed", {
      service: "cloudflare",
      error: err,
      data: { resourceId, r2Key },
    });
    throw new Error(
      "PDF dosyası Cloudflare R2 sistemine yüklenirken bir hata oluştu.",
    );
  }
}

/**
 * Deletes a PDF file from Cloudflare R2 Bucket by its APA filename.
 *
 * @param apaFileName APA-styled standardized filename (e.g. Yilmaz_2024_Turk_Edebiyati.pdf)
 */
export async function deletePdfFromR2(apaFileName: string): Promise<void> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  const bucketName = process.env.R2_BUCKET_NAME || "fabricca";
  const r2Key = `pdfs/${apaFileName}`;

  try {
    const s3Client = getR2Client();

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: r2Key,
      }),
    );

    log.info("r2_delete_success", {
      service: "cloudflare",
      data: { r2Key },
    });
  } catch (err) {
    log.error("r2_delete_failed", {
      service: "cloudflare",
      error: err,
      data: { r2Key },
    });
    throw new Error(
      "PDF dosyası Cloudflare R2 sisteminden silinirken bir hata oluştu.",
    );
  }
}
