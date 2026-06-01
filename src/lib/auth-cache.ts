/**
 * Memoized wrapper around `getExpectedHash`.
 *
 * `getExpectedHash` performs a SHA-256 over `password + "fabricca_salt"` on
 * every call. That's tiny (~5-20ms), but in Next.js hot paths (proxy,
 * RootLayout, page) it can run several times per request. The hash is
 * purely a function of `APP_PASSWORD` and the static salt, so it never
 * changes during the lifetime of a server instance.
 *
 * We cache the hash keyed by password on `globalThis` so it survives HMR
 * and is computed once per server boot.
 */

import { getExpectedHash as computeHash } from "./auth";

declare global {
  var __fabriccaHashCache: { password: string; hash: string } | undefined;
}

export async function getCachedExpectedHash(password: string): Promise<string> {
  const cached = globalThis.__fabriccaHashCache;
  if (cached && cached.password === password) {
    return cached.hash;
  }
  const hash = await computeHash(password);
  globalThis.__fabriccaHashCache = { password, hash };
  return hash;
}
