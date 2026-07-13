import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Drizzle Kit'e .env.local dosyasını okumasını açıkça söylüyoruz
config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
