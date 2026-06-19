import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionWithOnboarding } from "@/session";
import { Header } from "@/components/header";

/**
 * Giriş sonrası ana uygulama layout'u.
 * Oturum kontrolü yapar, geçersizse /login'e yönlendirir.
 * Oturum varsa onboarding durumunu kontrol eder; tamamlanmamışsa
 * kullanıcıyı /onboarding sayfasına yönlendirir.
 *
 * cacheComponents (PPR) gereği layout'un kendisi cookies() gibi runtime
 * API'lere erişemez; auth kontrolü Suspense-wrapped iç bileşene taşınmıştır.
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
      <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-24 sm:px-6 lg:px-8 md:pb-6">
        {children}
      </main>
    </div>
  );
}
