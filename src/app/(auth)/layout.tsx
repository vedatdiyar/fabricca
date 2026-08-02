import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionWithOnboarding } from "@/lib/session";

/**
 * Layout for authentication pages; redirects signed-in users to /onboarding or /dashboard
 * based on onboarding status. Auth check lives in a Suspense-wrapped inner component
 * because PPR forbids runtime APIs like cookies() in the layout itself.
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
