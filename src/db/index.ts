import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Load environment variables (essential for CLI tasks/standalone scripts)
config({ path: ".env.local" });

if (!process.env.NEON_DATABASE_URL) {
  throw new Error("NEON_DATABASE_URL environment variable is missing.");
}

const sql = neon(process.env.NEON_DATABASE_URL);
export const db = drizzle({ client: sql, schema });
