import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load env variables from .env.local as Next.js does
config({ path: ".env.local" });

if (!process.env.NEON_DATABASE_URL) {
  throw new Error(
    "NEON_DATABASE_URL environment variable is missing in .env.local",
  );
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.NEON_DATABASE_URL!,
  },
});
