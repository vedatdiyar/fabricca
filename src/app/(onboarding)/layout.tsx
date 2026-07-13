import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionWithOnboarding } from "@/lib/session";

/**
 * Onboarding route group layout.
 * Güvenlik kontrolü yapar:
 * - Oturum yoksa /login sayfasına yönlendirir.
 * - Oturum varsa ve onboarding zaten tamamlanmışsa /dashboard sayfasına yönlendirir.
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
