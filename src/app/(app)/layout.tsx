import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionWithOnboarding } from "@/lib/session";
import { Header } from "@/components/header";

/**
 * Authenticated app layout.
 * Validates the session and onboarding status, then renders the header
 * and page content within a max-w-7xl container.
 *
 * PPR/cache compatibility: the layout itself cannot access cookies() directly;
 * auth is delegated to a Suspense-wrapped inner component.
 */
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense fallback={null}>
      <AppLayoutInner>{children}</AppLayoutInner>
    </Suspense>
  );
}

async function AppLayoutInner({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSessionWithOnboarding();

  if (!session) {
    redirect("/login");
  }

  if (!session.onboardingCompleted) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen">
      <Header userName={session.name} />
      <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8 md:pb-6">
        {children}
      </main>
    </div>
  );
}
