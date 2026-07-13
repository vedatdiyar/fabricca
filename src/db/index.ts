import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

/**
 * Neon PostgreSQL bağlantısı (WebSocket Pool + Global Singleton).
 *
 * `Pool` (WebSocket tabanlı) kullanarak `db.transaction()` desteği
 * sağlanır. Geliştirme ortamında (HMR / Fast Refresh) her modül
 * yeniden yüklendiğinde yeni bir Pool oluşmasını engellemek için
 * singleton deseni kullanılır.
 *
 * Örnek kullanım:
 *   const result = await db.select().from(...);
 *   await db.transaction(async (tx) => { ... });
 */
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

const pool =
  globalForDb.pool ?? new Pool({ connectionString: process.env.DATABASE_URL });
globalForDb.pool = pool;

export const db = drizzle(pool, { schema, casing: "snake_case" });
