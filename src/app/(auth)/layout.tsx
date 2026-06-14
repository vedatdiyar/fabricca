import { redirect } from "next/navigation";
import { headers } from "next/headers";
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

  if (session) {
    if (session.onboardingCompleted) {
      redirect("/dashboard");
    }

    const headersList = await headers();
    const pathname = headersList.get("x-invoke-path") ?? "";

    if (!pathname.includes("/onboarding")) {
    }
  }

  return <>{children}</>;
}
