import { S3Client } from "@aws-sdk/client-s3";

const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const accessKeyId =
  process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
  process.env.CLOUDFLARE_R2_ACCESS_KEY_id;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

// Check if credentials exist and raise standard error or warning if missing in runtime
if (!accountId || !accessKeyId || !secretAccessKey) {
  console.warn(
    "⚠️ Warning: Cloudflare R2 environment variables are missing! R2 client will fail to initialize properly.",
  );
}

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId || "placeholder"}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId || "placeholder",
    secretAccessKey: secretAccessKey || "placeholder",
  },
});

export const R2_BUCKET_NAME =
  process.env.CLOUDFLARE_R2_BUCKET_NAME || "fabricca-library";
