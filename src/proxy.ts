import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCachedExpectedHash } from "@/lib/auth-cache";
import { db } from "@/db";
import { thesisCore } from "@/db/schema";

/**
 * Next.js Proxy (formerly Middleware).
 *
 * Responsibilities (single source of truth):
 *   1. Cookie-based session auth (memoized hash, no per-request SHA-256)
 *   2. Onboarding gate — checks `thesis_core` once and propagates the
 *      result to downstream components via the `x-thesis-state` request
 *      header, eliminating the 3x concurrent DB race in dev/prod cold-starts
 *   3. Aggressive warmup — a tiny `SELECT 1` primes the Neon compute
 *      before the real query, mitigating "Control plane request failed"
 *      on first request after scale-to-zero
 *
 * Downstream consumers:
 *   - src/app/layout.tsx   reads `x-thesis-state` from request headers
 *   - src/app/page.tsx     same, for redirect decision
 */

const HEADER = "x-thesis-state";
type ThesisState = "present" | "empty" | "unknown";

declare global {
  var __fabriccaWarmupPromise: Promise<void> | undefined;
}

async function warmNeon(): Promise<void> {
  // Reuse a single warmup promise across concurrent requests within the
  // same server instance. Once warm, the promise is cleared so future
  // warmups (e.g. after long idle) can fire again.
  if (globalThis.__fabriccaWarmupPromise) {
    return globalThis.__fabriccaWarmupPromise;
  }
  const p = (async () => {
    try {
      // Minimal probe — the retry wrapper + single-flight inside `db` handle
      // control-plane 500s automatically.
      await db.execute("SELECT 1");
    } catch {
      // Swallow: the real query will retry through neonFetchRetry. We don't
      // want a warmup failure to block the proxy.
    } finally {
      // Clear after a short delay so the *first* request after wake-up
      // shares its warmup with concurrent siblings, but later requests
      // re-warm if the compute went back to sleep.
      setTimeout(() => {
        globalThis.__fabriccaWarmupPromise = undefined;
      }, 30_000);
    }
  })();
  globalThis.__fabriccaWarmupPromise = p;
  return p;
}

async function checkThesisState(): Promise<ThesisState> {
  if (!process.env.NEON_DATABASE_URL) {
    // No DB configured → don't block the user into onboarding. Layout
    // treats this as "not authenticated" anyway if APP_PASSWORD is also
    // missing, so it lands on the public tree.
    return "unknown";
  }
  try {
    // Warmup runs first to mitigate cold-start 500s.
    await warmNeon();
    const rows = await db.select().from(thesisCore).limit(1);
    return rows.length === 0 ? "empty" : "present";
  } catch (error) {
    console.error("[proxy] thesis state check failed:", error);
    // Consistent fallback: treat as "empty" so we route to /onboarding,
    // which is safe because onboarding auto-redirects back when the table
    // actually has data (the user will simply re-trigger this proxy and
    // get the correct state once the DB recovers).
    return "empty";
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/login";

  // 1. Auth check (memoized — SHA-256 runs once per server boot)
  const sessionCookie = request.cookies.get("academialab_session")?.value;
  const password = process.env.APP_PASSWORD;
  const expectedHash = password ? await getCachedExpectedHash(password) : "";
  const isAuthenticated = !password || sessionCookie === expectedHash;

  // Build the response we'll return at the end. We need to inject the
  // `x-thesis-state` header into the *request* scope so downstream
  // server components can read it via `headers()`.
  const requestHeaders = new Headers(request.headers);
  // Default to unknown; the real check below will overwrite.
  requestHeaders.set(HEADER, "unknown");

  if (!isAuthenticated) {
    if (!isLoginPage) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Authenticated and on /login → bounce to home
  if (isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 2. Onboarding state — single DB check, propagate via header
  const state = await checkThesisState();
  requestHeaders.set(HEADER, state);

  const isOnboardingPage = pathname === "/onboarding";

  if (state === "empty") {
    if (!isOnboardingPage) {
      // `x-thesis-state` is not forwarded on redirects — the browser will
      // issue a fresh GET to /onboarding and the proxy will re-evaluate,
      // setting the header for that new request scope. So no `request`
      // field is needed (and not supported) on `NextResponse.redirect`.
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  } else {
    if (isOnboardingPage) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/",
    "/library/:path*",
    "/advisor/:path*",
    "/onboarding/:path*",
    "/login",
  ],
};
