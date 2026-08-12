export const instant = false;

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionWithOnboarding } from "@/lib/session";

/**
 * Layout for authentication pages that redirects signed-in users to /onboarding or
 * /dashboard based on onboarding status, with the auth check living in a Suspense-wrapped
 * inner component because PPR forbids runtime APIs like cookies() in the layout itself.
 *
 * @param root0 - Layout props.
 * @param root0.children - The page content to render.
 * @returns The auth layout markup.
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense fallback={null}>
      <AuthLayoutInner>{children}</AuthLayoutInner>
    </Suspense>
  );
}

/**
 * Redirects already authenticated users away from auth pages based on their onboarding status.
 *
 * @param root0 - Layout props.
 * @param root0.children - The page content to render.
 * @returns The inner auth layout markup.
 */
async function AuthLayoutInner({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSessionWithOnboarding();
  if (session) {
    if (session.onboardingCompleted) {
      redirect("/dashboard");
    } else {
      redirect("/onboarding");
    }
  }

  return <>{children}</>;
}
