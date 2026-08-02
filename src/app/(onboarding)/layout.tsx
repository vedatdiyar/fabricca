import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionWithOnboarding } from "@/lib/session";

/**
 * Guards onboarding routes: redirects unauthenticated users to /login and completed users to /dashboard.
 */
export default function OnboardingGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense fallback={null}>
      <OnboardingGroupLayoutInner>{children}</OnboardingGroupLayoutInner>
    </Suspense>
  );
}

async function OnboardingGroupLayoutInner({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSessionWithOnboarding();

  if (!session) {
    redirect("/login");
  }

  if (session.onboardingCompleted) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
