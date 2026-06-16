import { OnboardingStepper } from "./_components/onboarding-stepper";
import { OnboardingGlobalLoader } from "@/components/onboarding-global-loader";

/**
 * Onboarding sürecinin tüm sayfalarını saran layout.
 * Sol tarafta dikey adım navigasyon sidebar'ını (stepper) sabitler
 * ve sağ tarafta sayfa içeriğini gösterir.
 * min-h-screen ve bg-background burada sağlanır,
 * böylece her sayfa kendi içerik div'inde bu sınıfları tekrar tanımlamaz.
 *
 * OnboardingGlobalLoader, en üst katmanda tüm ekranı kaplayacak şekilde
 * konumlandırılır (fixed inset-0 z-50). isLoading=false iken null döner,
 * böylece normal sayfa akışı hiç etkilenmez.
 */
export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen bg-background">
      <OnboardingGlobalLoader />
      <OnboardingStepper />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
