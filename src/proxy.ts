import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getExpectedHash } from "./lib/auth";

export async function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get("academialab_session")?.value;
  const password = process.env.APP_PASSWORD;

  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/login";

  // Calculate the expected session hash if password is configured.
  // If not configured, expectedHash is empty to prevent unauthorized bypass.
  const expectedHash = password ? await getExpectedHash(password) : "";
  const isAuthenticated = !!password && sessionCookie === expectedHash;

  if (!isAuthenticated) {
    // If not authenticated and trying to access a protected page, redirect instantly to /login
    if (!isLoginPage) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  } else {
    // If authenticated and trying to access the login page, redirect instantly to /dashboard
    if (isLoginPage) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/library/:path*",
    "/advisor/:path*",
    "/onboarding/:path*",
    "/login",
  ],
};
