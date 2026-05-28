import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2";
import { sanitizeFileName } from "../_utils/file-helpers";

/**
 * Generates a unique key for Cloudflare R2 storage based on current timestamp
 * and a sanitized version of the original filename.
 */
export function generateUniqueR2Key(fileName: string): string {
  const sanitizedName = sanitizeFileName(fileName);
  return `${Date.now()}-${sanitizedName}`;
}

/**
 * Uploads a file buffer securely to Cloudflare R2.
 */
export async function uploadPdfToR2(
  key: string,
  buffer: Buffer,
): Promise<void> {
  const uploadCommand = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: "application/pdf",
  });

  await r2Client.send(uploadCommand);
}

/**
 * Deletes a file from Cloudflare R2.
 */
export async function deletePdfFromR2(key: string): Promise<void> {
  const deleteCommand = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  await r2Client.send(deleteCommand);
}

/**
 * Generates a temporary secure presigned GET URL for a given R2 key.
 * By default, URLs are valid for 24 hours (86400 seconds).
 */
export async function generatePresignedUrl(
  key: string,
  expiresInSeconds: number = 86400,
): Promise<string> {
  const downloadCommand = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(r2Client, downloadCommand, {
    expiresIn: expiresInSeconds,
  });
}
