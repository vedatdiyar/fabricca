export const instant = false;

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionWithOnboarding } from "@/lib/session";

/**
 * Guards onboarding routes: redirects unauthenticated users to /login and completed users to /dashboard.
 *
 * @param root0 - The layout props object.
 * @param root0.children - The child pages rendered within the layout.
 * @returns The onboarding layout markup.
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

/**
 * Resolves the session and redirects unauthenticated or onboarding-completed users.
 *
 * @param root0 - The layout props object.
 * @param root0.children - The child pages rendered within the layout.
 * @returns The guarded onboarding layout markup.
 */
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
