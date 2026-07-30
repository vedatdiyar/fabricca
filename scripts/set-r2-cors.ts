/**
 * One-time script: Set CORS policy on the Cloudflare R2 bucket.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *
 * Run: npx tsx scripts/set-r2-cors.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

async function main() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || "fabricca";

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error(
      "Missing R2 credentials in environment (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)",
    );
    process.exit(1);
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const corsConfig = {
    CORSRules: [
      {
        AllowedOrigins: [
          "http://localhost:3000",
          "https://fabricca.vercel.app",
        ],
        AllowedMethods: ["PUT", "POST", "GET", "HEAD", "DELETE"],
        AllowedHeaders: ["content-type", "x-amz-*"],
        ExposeHeaders: ["ETag"],
        MaxAgeSeconds: 3600,
      },
    ],
  };

  console.log(`Setting CORS on bucket "${bucketName}"...`);
  console.log("AllowedOrigins:", corsConfig.CORSRules[0].AllowedOrigins);

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: corsConfig,
    }),
  );

  console.log("CORS policy applied successfully.");
}

main().catch((err) => {
  console.error("Failed to set CORS:", err);
  process.exit(1);
});
