import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

// Load environmental variables from .env.local
config({ path: ".env.local" });

async function main() {
  const url = process.env.NEON_DATABASE_URL;
  if (!url) {
    console.error("NEON_DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  console.log("Connecting to Neon to create pgvector extension...");
  const sql = neon(url);

  try {
    // Enable pgvector extension
    await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
    console.log('✅ Extension "vector" (pgvector) enabled successfully!');
  } catch (error) {
    console.error("❌ Failed to enable pgvector extension:", error);
    process.exit(1);
  }
}

main();
