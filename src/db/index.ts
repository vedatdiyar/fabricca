import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { neonFetchRetry } from "@/lib/db-retry";
import { singleFlightSql } from "@/lib/db-singleflight";

// NOTE: This module must be Edge-runtime safe so that `src/proxy.ts`
// (Next.js proxy/middleware) can share the same singleton client. Do not
// import `dotenv` or any Node-only APIs here. CLI scripts (seed-*.ts,
// setup-extensions.ts) load their own .env.local via their own dotenv import.

if (!process.env.NEON_DATABASE_URL) {
  throw new Error("NEON_DATABASE_URL environment variable is missing.");
}

/**
 * Singleton Neon HTTP client.
 *
 * Why singleton: `neon()` parses the connection string and constructs a
 * fetch wrapper on every call. In the Next.js hot path (proxy + layout + page)
 * that adds ~50-150ms per request. Mounting on `globalThis` ensures we
 * build it once per server instance and survive HMR reloads in dev.
 *
 * The client itself is wrapped with:
 *   1. `neonFetchRetry` — HTTP-level retry with exponential backoff
 *   2. `singleFlightSql` — query-level de-duplication of concurrent calls
 */
declare global {
  // The Neon HTTP type has multiple generic overloads; storing on
  // `globalThis` requires `any` to round-trip between module reloads
  // without TypeScript variance errors.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var __fabriccaNeonClient: any;
}

function buildNeonClient() {
  // The `fetch` option on Neon's options object is supported at runtime
  // but not in all overloads of the public types. Cast through `any`
  // here to keep types strict everywhere else.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = { fetch: neonFetchRetry };
  const raw = neon(process.env.NEON_DATABASE_URL!, options);
  return singleFlightSql(raw);
}

const sql = globalThis.__fabriccaNeonClient ?? buildNeonClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__fabriccaNeonClient = sql;
}

export const db = drizzle({ client: sql, schema });
