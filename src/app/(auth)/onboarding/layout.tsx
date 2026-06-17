import { OnboardingStepper } from "./_components/onboarding-stepper";
import { OnboardingContent } from "./_components/onboarding-content";

/**
 * Onboarding sürecinin tüm sayfalarını saran layout.
 * Sol tarafta dikey adım navigasyon sidebar'ını (stepper) sabitler
 * ve sağ tarafta sayfa içeriğini gösterir.
 *
 * OnboardingContent, isLoading durumuna göre ya loading ekranını
 * ya da sayfa içeriğini render eder. Loading ekranı modal değil,
 * içerik alanının yerine geçer ve yatay+dikey ortalanır.
 */
export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen bg-background">
      <OnboardingStepper />
      <main className="flex-1 min-w-0">
        <OnboardingContent>{children}</OnboardingContent>
      </main>
    </div>
  );
}
