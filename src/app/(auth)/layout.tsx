import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionWithOnboarding } from "@/session";

/**
 * Kimlik doğrulama sayfaları için layout.
 * Oturum açıksa onboarding durumuna göre kullanıcıyı
 * /onboarding (tamamlanmamış) veya /dashboard (tamamlanmış)
 * sayfasına yönlendirir.
 *
 * cacheComponents (PPR) gereği layout'un kendisi cookies() gibi runtime
 * API'lere erişemez; auth kontrolü Suspense-wrapped iç bileşene taşınmıştır.
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

  if (session?.onboardingCompleted) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
