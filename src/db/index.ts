import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Neon PostgreSQL bağlantısı (Global Singleton).
 *
 * Geliştirme ortamında (HMR / Fast Refresh) her modül yeniden
 * yüklendiğinde yeni bir Neon HTTP istemcisi oluşmasını engeller.
 * `globalThis` üzerinde saklanan bağlantı, HMR sırasında bile
 * korunur ve tekrar kullanılır.
 *
 * Production'da (serverless) her istek yeni bir ortamda çalıştığı
 * için her seferinde yeni bağlantı oluşur — bu beklenen davranıştır.
 *
 * Örnek kullanım:
 *   const result = await db.select().from(...);
 */
const globalForDb = globalThis as unknown as {
  conn: ReturnType<typeof neon> | undefined;
};

const conn = globalForDb.conn ?? neon(process.env.DATABASE_URL!);
globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
