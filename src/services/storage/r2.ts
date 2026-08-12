import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Returns a singleton S3 client configured for Cloudflare R2.
 *
 * @returns Configured S3 client instance.
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
 * Uploads a PDF file buffer to a Cloudflare R2 bucket.
 *
 * @param buffer - Raw PDF file buffer.
 * @param resourceId - ID of the linked library resource.
 * @param apaFileName - APA-styled standardized filename (e.g. Yilmaz_2024_Turk_Edebiyati.pdf).
 * @returns Object containing the public URL and R2 key.
 */
export async function uploadPdfToR2(
  buffer: Buffer,
  resourceId: number,
  apaFileName: string,
): Promise<{ r2Url: string; r2Key: string }> {
  const bucketName = process.env.R2_BUCKET_NAME || "fabricca";
  const publicDomain = process.env.R2_PUBLIC_DOMAIN;

  if (!publicDomain) {
    throw new Error(
      "Cloudflare R2 public domain (R2_PUBLIC_DOMAIN) is missing in environment variables.",
    );
  }

  const r2Key = `pdfs/${apaFileName}`;

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

  return { r2Url, r2Key };
}

/**
 * Deletes a PDF file from Cloudflare R2 by its APA filename.
 *
 * @param apaFileName - APA-styled standardized filename (e.g. Yilmaz_2024_Turk_Edebiyati.pdf).
 */
export async function deletePdfFromR2(apaFileName: string): Promise<void> {
  const bucketName = process.env.R2_BUCKET_NAME || "fabricca";
  const r2Key = `pdfs/${apaFileName}`;

  const s3Client = getR2Client();

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: r2Key,
    }),
  );
}

/**
 * Generates a presigned GET URL for a private R2 object.
 * Used to give Mistral OCR temporary read access without making the bucket public.
 *
 * @param r2Key - The R2 object key (e.g. "pdfs/Yilmaz_2024_Turk_Edebiyati.pdf").
 * @param expiresIn - URL validity in seconds (default: 300 s = 5 min).
 * @returns A presigned URL string valid for the specified duration.
 */
export async function generatePresignedReadUrl(
  r2Key: string,
  expiresIn = 300,
): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME || "fabricca";
  const s3Client = getR2Client();

  return getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: bucketName, Key: r2Key }),
    { expiresIn },
  );
}

/**
 * Generates a 15-minute presigned upload URL for direct browser-to-R2 upload.
 *
 * @param r2Key - The target key in the R2 bucket (e.g. "temp/<uuid>.pdf").
 * @param contentType - MIME type of the file being uploaded.
 * @returns A presigned URL string.
 */
export async function generatePresignedUploadUrl(
  r2Key: string,
  contentType: string,
): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME || "fabricca";
  const s3Client = getR2Client();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: r2Key,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, { expiresIn: 900 });
}

/**
 * Fetches a PDF file buffer from R2 by its key.
 *
 * @param r2Key - The R2 object key (e.g. "pdfs/Yilmaz_2024_Turk_Edebiyati.pdf").
 * @returns The file buffer.
 */
export async function getPdfFromR2(r2Key: string): Promise<Buffer> {
  const bucketName = process.env.R2_BUCKET_NAME || "fabricca";
  const s3Client = getR2Client();

  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: r2Key,
    }),
  );

  const body = response.Body;
  if (!body) {
    throw new Error(`R2 object ${r2Key} returned empty body.`);
  }

  const bytes = await body.transformToByteArray();

  return Buffer.from(bytes);
}

/**
 * Deletes an object from R2 by its full key.
 *
 * @param r2Key - The R2 object key to delete.
 */
export async function deleteR2Object(r2Key: string): Promise<void> {
  const bucketName = process.env.R2_BUCKET_NAME || "fabricca";
  const s3Client = getR2Client();

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: r2Key,
    }),
  );
}
