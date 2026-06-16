import { redirect } from "next/navigation";
import { getSessionWithOnboarding } from "@/proxy";

/**
 * Kimlik doğrulama sayfaları için layout.
 * Oturum açıksa onboarding durumuna göre kullanıcıyı
 * /onboarding (tamamlanmamış) veya /dashboard (tamamlanmış)
 * sayfasına yönlendirir. Kullanıcı zaten /onboarding sayfasındaysa
 * yönlendirme yapmaz, böylece sonsuz döngü engellenir.
 */
export default async function AuthLayout({
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
