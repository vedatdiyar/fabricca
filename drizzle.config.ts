import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Drizzle Kit'e .env.local dosyasını okumasını açıkça söylüyoruz
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
