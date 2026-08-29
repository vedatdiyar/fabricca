import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

/** Neon PostgreSQL connection — WebSocket Pool with a global singleton (enables db.transaction() and safe HMR reloads). */
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

const pool =
  globalForDb.pool ??
  (() => {
    const p = new Pool({ connectionString: process.env.DATABASE_URL });
    p.on("error", (err: unknown) => {
      // Idle WebSocket connections to Neon may drop or time out; catching here avoids uncaughtException crashes.
      console.warn("Neon DB pool idle connection event:", err);
    });
    return p;
  })();
globalForDb.pool = pool;

export const db = drizzle(pool, { schema, casing: "snake_case" });
