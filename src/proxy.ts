import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getExpectedHash } from "./lib/auth";
import { neon } from "@neondatabase/serverless";

export async function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get("academialab_session")?.value;
  const password = process.env.APP_PASSWORD;

  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/login";

  // Calculate the expected session hash if password is configured.
  // If not configured, expectedHash is empty to prevent unauthorized bypass.
  // We treat it as authenticated if password is not configured yet (for developer ease).
  const expectedHash = password ? await getExpectedHash(password) : "";
  const isAuthenticated = !password || sessionCookie === expectedHash;

  if (!isAuthenticated) {
    // If not authenticated and trying to access a protected page, redirect instantly to /login
    if (!isLoginPage) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  } else {
    // If authenticated and trying to access the login page, redirect instantly to /
    if (isLoginPage) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // 2. Onboarding Status Check
    // We query Neon PostgreSQL to see if thesis_core table is empty.
    let isThesisCoreEmpty = true;
    if (process.env.NEON_DATABASE_URL) {
      try {
        const sql = neon(process.env.NEON_DATABASE_URL);
        // Execute a quick, low-overhead SELECT query to check for existence of thesis_core
        const result = await sql`SELECT id FROM thesis_core LIMIT 1`;
        isThesisCoreEmpty = result.length === 0;
      } catch (error) {
        console.error("Database query failed in proxy:", error);
        // In case of db connection issues, fallback to allowing request to avoid locking the user
        isThesisCoreEmpty = false;
      }
    } else {
      // If no db url is configured, assume onboarding is complete to not break initial layout dev
      isThesisCoreEmpty = false;
    }

    const isOnboardingPage = pathname === "/onboarding";

    if (isThesisCoreEmpty) {
      // If onboarding is not completed, force the user to /onboarding
      if (!isOnboardingPage) {
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }
    } else {
      // If onboarding is already completed, block direct access to /onboarding and redirect to dashboard
      if (isOnboardingPage) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
  }

  return NextResponse.next();
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
