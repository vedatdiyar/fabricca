import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Neon PostgreSQL bağlantısı.
 * DATABASE_URL .env.local dosyasından okunur.
 * Örnek kullanım:
 *   const result = await db.select().from(...);
 */
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
