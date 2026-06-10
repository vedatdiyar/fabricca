import { redirect } from "next/navigation";
import { getSessionWithOnboarding } from "@/proxy";
import { Header } from "@/components/header";

/**
 * Giriş sonrasi ana uygulama layout'u.
 * Oturum kontrolü yapar, geçersizse /login'e yönlendirir.
 * Oturum varsa onboarding durumunu kontrol eder; tamamlanmamışsa
 * kullanıcıyı /onboarding sayfasına yönlendirir.
 * Kullanici adini Header bileşenine aktarir.
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSessionWithOnboarding();

  if (!session) {
    redirect("/login");
  }

  if (session.onboardingStep !== "completed") {
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
