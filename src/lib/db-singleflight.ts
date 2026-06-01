/**
 * Single-flight pattern for Neon HTTP queries.
 *
 * When 3 components (proxy, RootLayout, page) hit the DB on the same request
 * lifecycle — especially during a Neon cold-start — the Neon Control Plane
 * can race and return 500s. This module de-duplicates concurrent in-flight
 * queries that share the same SQL + parameters: only the first call hits the
 * network, the rest `await` the same promise.
 *
 * The cache is mounted on `globalThis` so it survives Next.js HMR reloads in
 * dev and module re-evaluation in Edge runtime.
 *
 * Note: This intentionally does NOT cache results across calls (no TTL). It
 * only collapses *concurrent* in-flight requests. After a query resolves,
 * the next call will issue a fresh request — preserving correctness for
 * data that changes (writes, updates).
 */

import type { NeonQueryFunction } from "@neondatabase/serverless";

type SingleFlightKey = string;

declare global {
  var __fabriccaSingleFlight: Map<SingleFlightKey, Promise<unknown>> | undefined;
}

const inflight: Map<SingleFlightKey, Promise<unknown>> =
  globalThis.__fabriccaSingleFlight ??
  (globalThis.__fabriccaSingleFlight = new Map());

function safeKey(sql: string, params: unknown): SingleFlightKey {
  try {
    return `${sql}::${JSON.stringify(params)}`;
  } catch {
    return sql;
  }
}

export async function singleFlight<T>(
  sql: string,
  params: unknown,
  fn: () => Promise<T>,
): Promise<T> {
  const key = safeKey(sql, params);
  const existing = inflight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fn().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

type AnyNeonQuery = NeonQueryFunction<boolean, boolean> | NeonQueryFunction<false, false>;

/**
 * Wrap a Neon `sql` template tag function so that concurrent calls with the
 * same template string collapse into a single underlying HTTP request.
 *
 * Usage:
 *   const sql = singleFlightSql(rawSql);
 *   await sql`SELECT id FROM thesis_core LIMIT 1`;
 */
export function singleFlightSql<T extends AnyNeonQuery>(rawSql: T): T {
  const wrapped = ((...args: unknown[]) => {
    const strings = args[0] as ReadonlyArray<string> | undefined;
    const values = args.slice(1);

    let composedSql = "";
    if (Array.isArray(strings) && strings.length > 0) {
      composedSql = strings[0];
      for (let i = 1; i < strings.length; i++) {
        composedSql += `$${i}${strings[i]}`;
      }
    }

    const fn = rawSql as unknown as (...a: unknown[]) => Promise<unknown>;
    return singleFlight(composedSql || "<raw>", values, () => fn(...args));
  }) as unknown as T;

  // Forward native properties so that Drizzle ORM can use
  // `client.query("SELECT $1", [x], opts)` directly — in Neon GA v1.0+
  // the main sql function only supports tagged-template syntax.
  const r = rawSql as unknown as {
    query: (...a: unknown[]) => unknown;
    unsafe: (...a: unknown[]) => unknown;
    transaction: (...a: unknown[]) => unknown;
  };

  Object.assign(wrapped as unknown as Record<string, unknown>, {
    query: r.query.bind(rawSql),
    unsafe: r.unsafe.bind(rawSql),
    transaction: r.transaction.bind(rawSql),
  });

  return wrapped;
}
